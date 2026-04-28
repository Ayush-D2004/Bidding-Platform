import json
import os
import asyncio
from typing import Dict, Any, Optional

import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

SYSTEM_PROMPT = """You are a cricket auction analyst. Given a player profile and current bid,
respond ONLY with valid JSON (no markdown, no code fences, no extra text):
{"verdict":"UNDERVALUED"|"FAIR_VALUE"|"OVERVALUED","confidence":0.0-1.0,
"reasoning":"2 sentence explanation","recommendation":"ACCEPT"|"HOLD"|"REJECT"}"""


def _build_user_message(player: Dict[str, Any], current_bid: int, fair_value: int) -> str:
    name = player.get("name", "Unknown")
    skill = player.get("skill_type", "unknown")
    base = player.get("base_price", 0)
    bat = player.get("bat_strength", 0)
    bowl = player.get("bowl_strength", 0)

    return (
        f"Player: {name}, "
        f"Skill: {skill} (Bat: {bat}/100, Bowl: {bowl}/100), "
        f"Base price: ₹{base // 100000}L, "
        f"Current bid: ₹{current_bid // 100000}L, "
        f"Fair value: ₹{fair_value // 100000}L. "
        f"Should the auctioneer accept this bid?"
    )


async def get_copilot_analysis(
    player: Dict[str, Any],
    current_bid: int,
    fair_value: int,
) -> Dict[str, Any]:
    """
    Call Gemini API to get auction copilot analysis.
    Returns JSON dict with verdict, confidence, reasoning, recommendation.
    Falls back to rule-based analysis if API key is missing or call fails.
    """
    if not GEMINI_API_KEY:
        return _rule_based_fallback(player, current_bid, fair_value)

    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=SYSTEM_PROMPT,
        )

        user_msg = _build_user_message(player, current_bid, fair_value)

        response = await asyncio.to_thread(
            model.generate_content,
            user_msg,
            generation_config=genai.GenerationConfig(
                max_output_tokens=300,
                temperature=0.3,
            ),
        )

        raw_text = response.text.strip()
        # Strip markdown fences if present
        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            raw_text = "\n".join(lines[1:-1]) if len(lines) > 2 else raw_text

        result = json.loads(raw_text)
        # Validate required keys
        required = {"verdict", "confidence", "reasoning", "recommendation"}
        if not required.issubset(result.keys()):
            raise ValueError("Missing required keys in response")

        return result

    except Exception as e:
        print(f"[Copilot] Gemini API error: {e}. Using rule-based fallback.")
        return _rule_based_fallback(player, current_bid, fair_value)


def _rule_based_fallback(
    player: Dict[str, Any], current_bid: int, fair_value: int
) -> Dict[str, Any]:
    """Deterministic rule-based fallback when Gemini is unavailable."""
    ratio = current_bid / max(fair_value, 1)
    skill_type = player.get("skill_type", "batting")

    if ratio < 0.85:
        verdict = "UNDERVALUED"
        recommendation = "ACCEPT"
        reasoning = (
            f"{player.get('name')} is currently bidding at "
            f"₹{current_bid // 100000}L against a fair value of ₹{fair_value // 100000}L "
            f"({round((1 - ratio) * 100)}% below market). "
            f"This {skill_type} specialist represents excellent value — accepting now locks in a premium asset."
        )
        confidence = min(0.95, 0.85 + (0.85 - ratio))
    elif ratio > 1.15:
        verdict = "OVERVALUED"
        recommendation = "REJECT"
        reasoning = (
            f"{player.get('name')} is being bid at "
            f"₹{current_bid // 100000}L which is {round((ratio - 1) * 100)}% above fair value "
            f"of ₹{fair_value // 100000}L. "
            f"Risk of overpaying for this {skill_type} — recommend holding until the price corrects."
        )
        confidence = min(0.95, 0.75 + (ratio - 1.15))
    else:
        verdict = "FAIR_VALUE"
        recommendation = "HOLD"
        reasoning = (
            f"{player.get('name')} is trading within the fair value band at "
            f"₹{current_bid // 100000}L (fair value: ₹{fair_value // 100000}L). "
            f"The {skill_type} market is pricing this player correctly; watch for further bid movement."
        )
        confidence = 0.72

    return {
        "verdict": verdict,
        "confidence": round(confidence, 2),
        "reasoning": reasoning,
        "recommendation": recommendation,
    }
