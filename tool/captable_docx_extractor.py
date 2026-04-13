from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree
from zipfile import ZipFile


ROOT = Path("/Users/curtis/Desktop/hackson")
DEFAULT_INPUT_DIR = ROOT / "test_doc"
WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


@dataclass
class Fact:
    field: str
    value: str | int | float | bool
    source_text: str
    confidence: float


@dataclass
class DocumentReport:
    file_name: str
    document_type: str
    captable_role: str
    confirmed_facts: list[Fact]
    pending_fields: list[str]
    referenced_attachments: list[str]
    warnings: list[str]


@dataclass
class NormalizedEvent:
    event_type: str
    source_document: str
    event_date: str | None
    status: str
    payload: dict[str, str | int | float | bool | list[str] | dict[str, int | float | str]]
    evidence_fields: list[str]
    limitations: list[str]


def read_docx_text(path: Path) -> str:
    with ZipFile(path) as archive:
        xml_bytes = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml_bytes)
    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", WORD_NAMESPACE):
        fragments = [node.text or "" for node in paragraph.findall(".//w:t", WORD_NAMESPACE)]
        line = re.sub(r"\s+", " ", "".join(fragments)).strip()
        if line:
            paragraphs.append(line)
    return "\n".join(paragraphs)


def normalize_number(raw: str) -> int:
    return int(raw.replace(",", ""))


def unique_preserve_order(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def extract_attachments(text: str) -> list[str]:
    matches = re.findall(r"\b(?:Exhibit|Schedule)\s+[A-Z0-9-]+\b", text)
    return unique_preserve_order(matches)


def extract_series_names(text: str) -> list[str]:
    matches = re.findall(r"Series\s+(?:Seed(?:-1)?|A-[123])\s+Preferred Stock", text)
    return unique_preserve_order(matches)


def classify_document(path: Path, text: str) -> str:
    name = path.name.lower()
    if "written consent of the board" in name:
        return "board_written_consent"
    if "stock purchase agreement" in name:
        return "series_a_stock_purchase_agreement"
    if "equity incentive plan" in name:
        return "equity_incentive_plan_amendment"
    if "investors' rights" in name:
        return "investors_rights_agreement"
    if "voting agreement" in name:
        return "voting_agreement"
    if "first refusal" in name or "co-sale" in name:
        return "rofr_and_cosale_agreement"
    if "purchase agreement" in text.lower():
        return "stock_purchase_agreement"
    return "other"


def add_match_fact(
    facts: list[Fact],
    text: str,
    field: str,
    pattern: str,
    transform,
    confidence: float,
) -> None:
    match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return
    facts.append(
        Fact(
            field=field,
            value=transform(match),
            source_text=re.sub(r"\s+", " ", match.group(0)).strip(),
            confidence=confidence,
        )
    )


def build_fact_lookup(report: DocumentReport) -> dict[str, Fact]:
    return {fact.field: fact for fact in report.confirmed_facts}


def analyze_equity_plan(path: Path, text: str) -> DocumentReport:
    facts: list[Fact] = []
    add_match_fact(
        facts,
        text,
        "company_name",
        r"This Second Amendment to the\s+(.+?)\s+\(this “Amendment”\)",
        lambda match: match.group(1).strip(),
        0.93,
    )
    add_match_fact(
        facts,
        text,
        "amendment_effective_date",
        r"effective as of\s+(\[[^\]]+\],\s*\d{4}|[A-Za-z]+\s+\d{1,2},\s+\d{4})",
        lambda match: match.group(1).strip(),
        0.9,
    )
    reserve_match = re.search(
        r"deleting “([\d,]+) Shares” and inserting in lieu thereof “([\d,]+) Shares”",
        text,
        flags=re.IGNORECASE,
    )
    if reserve_match:
        old_reserve = normalize_number(reserve_match.group(1))
        new_reserve = normalize_number(reserve_match.group(2))
        source_text = re.sub(r"\s+", " ", reserve_match.group(0)).strip()
        facts.extend(
            [
                Fact("plan_reserve_before_amendment", old_reserve, source_text, 0.99),
                Fact("plan_reserve_after_amendment", new_reserve, source_text, 0.99),
                Fact("plan_reserve_increase", new_reserve - old_reserve, source_text, 0.99),
            ]
        )
    add_match_fact(
        facts,
        text,
        "board_and_stockholder_approval_present",
        r"Board\), dated as of .+?Stockholders\), dated as of .+?approved an increase",
        lambda match: True,
        0.95,
    )
    return DocumentReport(
        file_name=path.name,
        document_type="equity_incentive_plan_amendment",
        captable_role="直接决定 option pool / reserved shares，属于 fully diluted cap table 的核心输入。",
        confirmed_facts=facts,
        pending_fields=[
            "board_approval_date",
            "stockholder_approval_date",
            "equity_award_grant_breakdown",
            "unused_option_pool_before_financing",
        ],
        referenced_attachments=extract_attachments(text),
        warnings=[
            "目前只确认了 plan reserve 的修订，不代表已拿到全部期权授予明细。",
        ],
    )


def analyze_spa(path: Path, text: str) -> DocumentReport:
    facts: list[Fact] = []
    add_match_fact(
        facts,
        text,
        "company_name",
        r"made as of\s+.+?,\s+by and among\s+(.+?),\s+a Delaware corporation",
        lambda match: match.group(1).strip(),
        0.94,
    )
    add_match_fact(
        facts,
        text,
        "agreement_date",
        r"made as of\s+(\[[^\]]+\],\s*\d{4}|[A-Za-z]+\s+\d{1,2},\s+\d{4})",
        lambda match: match.group(1).strip(),
        0.9,
    )
    add_match_fact(
        facts,
        text,
        "series_a_1_price_per_share",
        r"Series A-1 Preferred Stock.*?purchase price of \$([\d.]+) per share",
        lambda match: float(match.group(1)),
        0.98,
    )
    prices_match = re.search(
        r"purchase price of\s+\$([\d.]+)\s+per share of Series A-2 Preferred Stock and \$([\d.]+)\s+per share of Series A-3 Preferred Stock",
        text,
        flags=re.IGNORECASE,
    )
    if prices_match:
        source_text = re.sub(r"\s+", " ", prices_match.group(0)).strip()
        facts.extend(
            [
                Fact("series_a_2_price_per_share", float(prices_match.group(1)), source_text, 0.99),
                Fact("series_a_3_price_per_share", float(prices_match.group(2)), source_text, 0.99),
            ]
        )
    add_match_fact(
        facts,
        text,
        "safe_conversion_price",
        r"fix the conversion price at \$([\d.]+) per share",
        lambda match: float(match.group(1)),
        0.99,
    )
    add_match_fact(
        facts,
        text,
        "has_initial_closing",
        r"Initial Closing",
        lambda match: True,
        0.96,
    )
    add_match_fact(
        facts,
        text,
        "has_additional_closing",
        r"Additional Closing",
        lambda match: True,
        0.96,
    )
    add_match_fact(
        facts,
        text,
        "has_tranche_1_closing",
        r"Tranche 1 Closing",
        lambda match: True,
        0.96,
    )
    add_match_fact(
        facts,
        text,
        "safe_automatically_converts_at_initial_closing",
        r"At the Initial Closing, all of such SAFE Purchaser’s SAFEs will automatically .*? convert into the number of shares of Series A-1 Preferred Stock",
        lambda match: True,
        0.97,
    )
    series_names = extract_series_names(text)
    if series_names:
        facts.append(
            Fact(
                field="security_series_detected",
                value=", ".join(series_names),
                source_text="; ".join(series_names),
                confidence=0.95,
            )
        )
    return DocumentReport(
        file_name=path.name,
        document_type="series_a_stock_purchase_agreement",
        captable_role="本轮融资主文档，直接承载证券类型、价格、SAFE 转股触发和 closing 结构。",
        confirmed_facts=facts,
        pending_fields=[
            "exhibit_a_safe_purchaser_rows",
            "exhibit_b_cash_purchaser_rows",
            "per_investor_share_counts",
            "aggregate_round_shares",
            "aggregate_round_cash_amount",
            "restated_certificate_authorized_shares",
        ],
        referenced_attachments=extract_attachments(text),
        warnings=[
            "正文确认了价格和转换逻辑，但 investor-level 股数通常在 Exhibit A / Exhibit B 中。",
            "存在 Initial / Additional / Tranche 1 closing，说明不能把本轮简单当作单次 closing 处理。",
        ],
    )


def analyze_investors_rights(path: Path, text: str) -> DocumentReport:
    facts: list[Fact] = []
    add_match_fact(
        facts,
        text,
        "company_name",
        r"by and among\s+(.+?),\s+a Delaware corporation",
        lambda match: match.group(1).strip(),
        0.9,
    )
    add_match_fact(
        facts,
        text,
        "major_investor_threshold_shares",
        r"Major Investor” means .*? holds at least ([\d,]+) shares of Registrable Securities",
        lambda match: normalize_number(match.group(1)),
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "prior_agreement_date",
        r"Investors’ Rights Agreement dated as of ([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        lambda match: match.group(1),
        0.96,
    )
    series_names = extract_series_names(text)
    if series_names:
        facts.append(
            Fact(
                field="preferred_stock_series_in_scope",
                value=", ".join(series_names),
                source_text="; ".join(series_names),
                confidence=0.95,
            )
        )
    return DocumentReport(
        file_name=path.name,
        document_type="investors_rights_agreement",
        captable_role="不是发行主凭证，但能补 Investors 范围、既有证券层级和某些阈值定义，可用于交叉校验。",
        confirmed_facts=facts,
        pending_fields=[
            "schedule_a_investor_list",
            "registrable_securities_holders",
            "pro_rata_holders",
        ],
        referenced_attachments=extract_attachments(text),
        warnings=[
            "该文件更适合做 holder universe 和证券定义校验，不应单独作为股数来源。",
        ],
    )


def analyze_voting(path: Path, text: str) -> DocumentReport:
    facts: list[Fact] = []
    add_match_fact(
        facts,
        text,
        "series_seed_preferred_director_count",
        r"Series Seed Preferred Stock.*?shall be entitled to elect one director",
        lambda match: 1,
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "series_a_preferred_director_count",
        r"Series A Preferred Stock.*?shall be entitled to elect two directors",
        lambda match: 2,
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "common_director_count",
        r"Common Stock.*?shall be entitled to elect two \(2\) directors",
        lambda match: 2,
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "requires_authorized_common_stock_increase_for_conversion",
        r"increase the number of authorized shares of Common Stock .*? sufficient shares of Common Stock available for conversion of all of the shares of Preferred Stock outstanding",
        lambda match: True,
        0.97,
    )
    series_names = extract_series_names(text)
    if series_names:
        facts.append(
            Fact(
                field="preferred_stock_series_in_scope",
                value=", ".join(series_names),
                source_text="; ".join(series_names),
                confidence=0.95,
            )
        )
    return DocumentReport(
        file_name=path.name,
        document_type="voting_agreement",
        captable_role="主要提供董事席位、转换支持和 holder 范围信号，适合作为辅助核验文档。",
        confirmed_facts=facts,
        pending_fields=[
            "schedule_a_investor_signatories",
            "schedule_b_key_holders",
            "holder_level_voting_blocks",
        ],
        referenced_attachments=extract_attachments(text),
        warnings=[
            "该文件能够支持证券层级与治理逻辑，但不能直接生成 cap table rows。",
        ],
    )


def analyze_board_consent(path: Path, text: str) -> DocumentReport:
    facts: list[Fact] = []
    add_match_fact(
        facts,
        text,
        "company_name",
        r"Board\) of\s+(.+?),\s+a Delaware corporation",
        lambda match: match.group(1).strip(),
        0.94,
    )
    add_match_fact(
        facts,
        text,
        "effective_date",
        r"ACTION BY WRITTEN CONSENT\s+OF THE BOARD OF DIRECTORS\s+(\[[^\]]+\],\s*\d{4}|[A-Za-z]+\s+\d{1,2},\s+\d{4})",
        lambda match: match.group(1).strip(),
        0.95,
    )
    add_match_fact(
        facts,
        text,
        "authorized_common_stock_after_restated_certificate",
        r"Common Stock”?\)\s+to\s+([\d,]+)\s+shares",
        lambda match: normalize_number(match.group(1)),
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "authorized_preferred_stock_after_restated_certificate",
        r"preferred stock of the Corporation to ([\d,]+) shares",
        lambda match: normalize_number(match.group(1)),
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "series_a_1_share_cap",
        r"up to ([\d,]+) shares of Series\s*A-1 Preferred Stock",
        lambda match: normalize_number(match.group(1)),
        0.99,
    )
    add_match_fact(
        facts,
        text,
        "series_a_2_share_cap",
        r"up to ([\d,]+) shares of Series\s*A-2 Preferred Stock",
        lambda match: normalize_number(match.group(1)),
        0.99,
    )
    add_match_fact(
        facts,
        text,
        "series_a_3_share_cap",
        r"up to ([\d,]+) shares of Series\s*A-3 Preferred Stock",
        lambda match: normalize_number(match.group(1)),
        0.99,
    )
    add_match_fact(
        facts,
        text,
        "series_a_1_price_per_share",
        r"Series\s*A-1 Shares.*?purchase price of \$([\d.]+) per share",
        lambda match: float(match.group(1)),
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "series_a_2_price_per_share",
        r"Series\s*A-2 Shares.*?purchase price of \$([\d.]+) per share",
        lambda match: float(match.group(1)),
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "series_a_3_price_per_share",
        r"Series\s*A-3 Shares.*?purchase price of \$([\d.]+) per share",
        lambda match: float(match.group(1)),
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "initial_plan_amendment_increase",
        r"reserve an additional ([\d,]+) shares of Common Stock and increase the total number of authorized shares of Common Stock issuable under the Plan to ([\d,]+)",
        lambda match: normalize_number(match.group(1)),
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "initial_plan_reserve_after_amendment",
        r"reserve an additional ([\d,]+) shares of Common Stock and increase the total number of authorized shares of Common Stock issuable under the Plan to ([\d,]+)",
        lambda match: normalize_number(match.group(2)),
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "tranche_1_plan_amendment_increase",
        r"further amend the Plan .*? reserve an additional ([\d,]+) shares of Common Stock and increase the total number of authorized shares of Common Stock issuable under the Plan to ([\d,]+)",
        lambda match: normalize_number(match.group(1)),
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "tranche_1_plan_reserve_after_amendment",
        r"further amend the Plan .*? reserve an additional ([\d,]+) shares of Common Stock and increase the total number of authorized shares of Common Stock issuable under the Plan to ([\d,]+)",
        lambda match: normalize_number(match.group(2)),
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "board_size_after_initial_closing",
        r"number of members of the Board is hereby increased to five \(5\)",
        lambda match: 5,
        0.99,
    )
    add_match_fact(
        facts,
        text,
        "safes_convert_into_series_a_1",
        r"the SAFEs will automatically convert into shares of Series A-1 Preferred Stock",
        lambda match: True,
        0.97,
    )
    add_match_fact(
        facts,
        text,
        "nq_shares_total",
        r"issuance by the Corporation of up to ([\d,]+) shares of Common Stock \(such shares, the “NQ Shares”\)",
        lambda match: normalize_number(match.group(1)),
        0.98,
    )
    add_match_fact(
        facts,
        text,
        "nq_shares_issued_at_initial_closing",
        r"upon the Initial Closing of the Series\s*A Financing,\s*([\d,]+) NQ Shares shall be issued",
        lambda match: normalize_number(match.group(1)),
        0.98,
    )
    return DocumentReport(
        file_name=path.name,
        document_type="board_written_consent",
        captable_role="是本轮 cap table 的强支持文档，能补足授权股本、各系列上限、董事会批准和部分非融资发行事项。",
        confirmed_facts=facts,
        pending_fields=[
            "stockholder_written_consent",
            "exhibit_a_restated_certificate_details",
            "exhibit_b_purchase_agreement_investor_rows",
            "board_member_shareholdings",
        ],
        referenced_attachments=extract_attachments(text),
        warnings=[
            "该文件确认了董事会批准和 share caps，但投资人逐户分配仍需回到 Purchase Agreement 的附表。",
            "该文件还包含 NQ Shares 等非融资普通股发行事项，后续计算 fully diluted 时需要单独建模。",
        ],
    )


def analyze_rofr(path: Path, text: str) -> DocumentReport:
    facts: list[Fact] = []
    add_match_fact(
        facts,
        text,
        "capital_stock_definition_includes_common_and_preferred",
        r"Capital Stock” means .*? shares of Common Stock and Preferred Stock",
        lambda match: True,
        0.95,
    )
    add_match_fact(
        facts,
        text,
        "capital_stock_definition_includes_options_warrants_convertibles",
        r"stock options, warrants or other convertible securities",
        lambda match: True,
        0.97,
    )
    series_names = extract_series_names(text)
    if series_names:
        facts.append(
            Fact(
                field="preferred_stock_series_in_scope",
                value=", ".join(series_names),
                source_text="; ".join(series_names),
                confidence=0.95,
            )
        )
    return DocumentReport(
        file_name=path.name,
        document_type="rofr_and_cosale_agreement",
        captable_role="主要补充 Key Holders / Investors / Capital Stock 定义，帮助识别 transfer-related holder universe。",
        confirmed_facts=facts,
        pending_fields=[
            "schedule_a_investor_list",
            "schedule_b_key_holder_list",
            "transfer_stock_scope_by_holder",
        ],
        referenced_attachments=extract_attachments(text),
        warnings=[
            "该文件更偏转让限制和 holder 身份集合，不是发行股数主来源。",
        ],
    )


def analyze_document(path: Path) -> DocumentReport:
    text = read_docx_text(path)
    document_type = classify_document(path, text)
    if document_type == "board_written_consent":
        return analyze_board_consent(path, text)
    if document_type == "equity_incentive_plan_amendment":
        return analyze_equity_plan(path, text)
    if document_type == "series_a_stock_purchase_agreement":
        return analyze_spa(path, text)
    if document_type == "investors_rights_agreement":
        return analyze_investors_rights(path, text)
    if document_type == "voting_agreement":
        return analyze_voting(path, text)
    if document_type == "rofr_and_cosale_agreement":
        return analyze_rofr(path, text)
    return DocumentReport(
        file_name=path.name,
        document_type=document_type,
        captable_role="尚未定义专用提取规则。",
        confirmed_facts=[],
        pending_fields=[],
        referenced_attachments=extract_attachments(text),
        warnings=["当前文件类型未进入第一版规则集。"],
    )


def build_events_for_document(report: DocumentReport) -> list[NormalizedEvent]:
    facts = build_fact_lookup(report)
    events: list[NormalizedEvent] = []

    if report.document_type == "equity_incentive_plan_amendment":
        if "plan_reserve_after_amendment" in facts:
            events.append(
                NormalizedEvent(
                    event_type="option_pool_increase",
                    source_document=report.file_name,
                    event_date=str(facts.get("amendment_effective_date").value) if "amendment_effective_date" in facts else None,
                    status="confirmed",
                    payload={
                        "plan_reserve_before": int(facts["plan_reserve_before_amendment"].value),
                        "plan_reserve_after": int(facts["plan_reserve_after_amendment"].value),
                        "plan_reserve_delta": int(facts["plan_reserve_increase"].value),
                    },
                    evidence_fields=[
                        "plan_reserve_before_amendment",
                        "plan_reserve_after_amendment",
                        "plan_reserve_increase",
                    ],
                    limitations=report.pending_fields,
                )
            )

    if report.document_type == "series_a_stock_purchase_agreement":
        if "series_a_1_price_per_share" in facts and "series_a_2_price_per_share" in facts and "series_a_3_price_per_share" in facts:
            events.append(
                NormalizedEvent(
                    event_type="series_a_financing_terms",
                    source_document=report.file_name,
                    event_date=str(facts.get("agreement_date").value) if "agreement_date" in facts else None,
                    status="partial",
                    payload={
                        "security_series": str(facts.get("security_series_detected").value).split(", ") if "security_series_detected" in facts else [],
                        "price_per_share": {
                            "Series A-1 Preferred Stock": float(facts["series_a_1_price_per_share"].value),
                            "Series A-2 Preferred Stock": float(facts["series_a_2_price_per_share"].value),
                            "Series A-3 Preferred Stock": float(facts["series_a_3_price_per_share"].value),
                        },
                        "has_initial_closing": bool(facts.get("has_initial_closing", Fact("", False, "", 0)).value),
                        "has_additional_closing": bool(facts.get("has_additional_closing", Fact("", False, "", 0)).value),
                        "has_tranche_1_closing": bool(facts.get("has_tranche_1_closing", Fact("", False, "", 0)).value),
                    },
                    evidence_fields=[
                        "series_a_1_price_per_share",
                        "series_a_2_price_per_share",
                        "series_a_3_price_per_share",
                        "has_initial_closing",
                        "has_additional_closing",
                        "has_tranche_1_closing",
                    ],
                    limitations=report.pending_fields,
                )
            )
        if "safe_conversion_price" in facts:
            events.append(
                NormalizedEvent(
                    event_type="safe_conversion_terms",
                    source_document=report.file_name,
                    event_date=str(facts.get("agreement_date").value) if "agreement_date" in facts else None,
                    status="partial",
                    payload={
                        "conversion_security": "Series A-1 Preferred Stock",
                        "conversion_price": float(facts["safe_conversion_price"].value),
                        "automatic_at_initial_closing": bool(
                            facts.get(
                                "safe_automatically_converts_at_initial_closing",
                                Fact("", False, "", 0),
                            ).value
                        ),
                    },
                    evidence_fields=[
                        "safe_conversion_price",
                        "safe_automatically_converts_at_initial_closing",
                    ],
                    limitations=report.pending_fields,
                )
            )

    if report.document_type == "board_written_consent":
        if "authorized_common_stock_after_restated_certificate" in facts and "authorized_preferred_stock_after_restated_certificate" in facts:
            events.append(
                NormalizedEvent(
                    event_type="authorized_capital_update",
                    source_document=report.file_name,
                    event_date=str(facts.get("effective_date").value) if "effective_date" in facts else None,
                    status="confirmed",
                    payload={
                        "authorized_common_stock": int(facts["authorized_common_stock_after_restated_certificate"].value),
                        "authorized_preferred_stock": int(facts["authorized_preferred_stock_after_restated_certificate"].value),
                    },
                    evidence_fields=[
                        "authorized_common_stock_after_restated_certificate",
                        "authorized_preferred_stock_after_restated_certificate",
                    ],
                    limitations=report.pending_fields,
                )
            )
        if "series_a_1_share_cap" in facts and "series_a_2_share_cap" in facts and "series_a_3_share_cap" in facts:
            events.append(
                NormalizedEvent(
                    event_type="series_a_financing_authorized",
                    source_document=report.file_name,
                    event_date=str(facts.get("effective_date").value) if "effective_date" in facts else None,
                    status="confirmed",
                    payload={
                        "share_caps": {
                            "Series A-1 Preferred Stock": int(facts["series_a_1_share_cap"].value),
                            "Series A-2 Preferred Stock": int(facts["series_a_2_share_cap"].value),
                            "Series A-3 Preferred Stock": int(facts["series_a_3_share_cap"].value),
                        },
                        "price_per_share": {
                            "Series A-1 Preferred Stock": float(facts["series_a_1_price_per_share"].value),
                            "Series A-2 Preferred Stock": float(facts["series_a_2_price_per_share"].value),
                            "Series A-3 Preferred Stock": float(facts["series_a_3_price_per_share"].value),
                        },
                    },
                    evidence_fields=[
                        "series_a_1_share_cap",
                        "series_a_2_share_cap",
                        "series_a_3_share_cap",
                        "series_a_1_price_per_share",
                        "series_a_2_price_per_share",
                        "series_a_3_price_per_share",
                    ],
                    limitations=report.pending_fields,
                )
            )
        if "initial_plan_amendment_increase" in facts:
            events.append(
                NormalizedEvent(
                    event_type="option_pool_increase_authorized",
                    source_document=report.file_name,
                    event_date=str(facts.get("effective_date").value) if "effective_date" in facts else None,
                    status="confirmed",
                    payload={
                        "phase": "initial_closing",
                        "plan_reserve_after": int(facts["initial_plan_reserve_after_amendment"].value),
                        "plan_reserve_delta": int(facts["initial_plan_amendment_increase"].value),
                    },
                    evidence_fields=[
                        "initial_plan_amendment_increase",
                        "initial_plan_reserve_after_amendment",
                    ],
                    limitations=report.pending_fields,
                )
            )
        if "tranche_1_plan_amendment_increase" in facts:
            events.append(
                NormalizedEvent(
                    event_type="option_pool_increase_authorized",
                    source_document=report.file_name,
                    event_date=str(facts.get("effective_date").value) if "effective_date" in facts else None,
                    status="conditional",
                    payload={
                        "phase": "tranche_1_closing",
                        "plan_reserve_after": int(facts["tranche_1_plan_reserve_after_amendment"].value),
                        "plan_reserve_delta": int(facts["tranche_1_plan_amendment_increase"].value),
                    },
                    evidence_fields=[
                        "tranche_1_plan_amendment_increase",
                        "tranche_1_plan_reserve_after_amendment",
                    ],
                    limitations=report.pending_fields,
                )
            )
        if "safes_convert_into_series_a_1" in facts:
            events.append(
                NormalizedEvent(
                    event_type="safe_conversion_authorized",
                    source_document=report.file_name,
                    event_date=str(facts.get("effective_date").value) if "effective_date" in facts else None,
                    status="confirmed",
                    payload={
                        "conversion_security": "Series A-1 Preferred Stock",
                        "automatic_at_initial_closing": True,
                    },
                    evidence_fields=["safes_convert_into_series_a_1"],
                    limitations=report.pending_fields,
                )
            )
        if "nq_shares_total" in facts:
            events.append(
                NormalizedEvent(
                    event_type="common_stock_issuance_commitment",
                    source_document=report.file_name,
                    event_date=str(facts.get("effective_date").value) if "effective_date" in facts else None,
                    status="partial",
                    payload={
                        "recipient_label": "NQ Clinic",
                        "security_type": "Common Stock",
                        "total_shares": int(facts["nq_shares_total"].value),
                        "shares_at_initial_closing": int(facts["nq_shares_issued_at_initial_closing"].value),
                    },
                    evidence_fields=[
                        "nq_shares_total",
                        "nq_shares_issued_at_initial_closing",
                    ],
                    limitations=report.pending_fields,
                )
            )

    return events


def build_all_events(reports: list[DocumentReport]) -> list[NormalizedEvent]:
    events: list[NormalizedEvent] = []
    for report in reports:
        events.extend(build_events_for_document(report))
    return events


def build_overall_summary(reports: list[DocumentReport]) -> dict:
    security_values = []
    for report in reports:
        for fact in report.confirmed_facts:
            if fact.field == "preferred_stock_series_in_scope":
                security_values.extend(value.strip() for value in str(fact.value).split(","))
            if fact.field == "security_series_detected":
                security_values.extend(value.strip() for value in str(fact.value).split(","))
    recognized_series = unique_preserve_order(value for value in security_values if value)
    uploaded_document_types = [report.document_type for report in reports]
    likely_missing_inputs = [
        "amended_and_restated_certificate_of_incorporation",
        "board_and_stockholder_consents_as_separate_documents",
        "cap_table_spreadsheet",
        "prior_seed_round_primary_documents",
        "option_grant_level_supporting_documents",
    ]
    return {
        "uploaded_document_types": uploaded_document_types,
        "recognized_security_series": recognized_series,
        "ready_for_event_types": [
            "option_pool_increase",
            "series_a_financing",
        ],
        "not_yet_safe_for_holder_level_captable": [
            "per_investor_share_rows",
            "ownership_percentages",
            "fully_diluted_denominator",
        ],
        "likely_missing_inputs_from_current_upload_set": likely_missing_inputs,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    docx_files = sorted(args.input_dir.glob("*.docx"))
    reports = [analyze_document(path) for path in docx_files]
    events = build_all_events(reports)
    payload = {
        "input_dir": str(args.input_dir),
        "document_count": len(reports),
        "overall_summary": build_overall_summary(reports),
        "documents": [asdict(report) for report in reports],
        "normalized_events": [asdict(event) for event in events],
    }
    output = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(output + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
