import os
import json
from flask import Flask, render_template, request, jsonify
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

app = Flask(__name__)

AI_INTEGRATIONS_OPENAI_API_KEY = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")
AI_INTEGRATIONS_OPENAI_BASE_URL = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")

client = OpenAI(
    api_key=AI_INTEGRATIONS_OPENAI_API_KEY,
    base_url=AI_INTEGRATIONS_OPENAI_BASE_URL
)

JUDGE_PROMPT = """あなたは冷徹な地獄の審判官です。法律ではなく、あなたの心にある『胸糞の悪さ』や『人間性の欠如』という基準で、二人の悪行を比較してください。
プレイヤーAとBは、交互に自分の悪行を告白します。

ルール：
1. 殺人、放火は禁止。それらが含まれていた場合、即座にそのプレイヤーを失格にしてください。
2. 後の告白は、前の告白よりも「精神的に不快」で「倫理的に欠如」していなければなりません。
3. どちらかの悪行が一方を上回っていない（前の罪より軽い、または同等）と判断した瞬間、試合終了を宣言し、より重い罪を告白した方を勝者としてください。
4. 各告白に対して、審判官としてのコメント（皮肉や嫌悪感を込めて）を必ず付けてください。
5. 出力は必ず以下のJSON形式で返してください：
{
  "judge_comment": "審判官としてのコメント（日本語）",
  "is_over": false,
  "winner": null
}

試合終了の場合：
{
  "judge_comment": "最終判定コメント（日本語）",
  "is_over": true,
  "winner": "A" or "B"
}"""


def is_rate_limit_error(exception):
    error_msg = str(exception)
    return (
        "429" in error_msg
        or "RATELIMIT_EXCEEDED" in error_msg
        or "quota" in error_msg.lower()
        or "rate limit" in error_msg.lower()
        or (hasattr(exception, "status_code") and exception.status_code == 429)
    )


@retry(
    stop=stop_after_attempt(7),
    wait=wait_exponential(multiplier=1, min=2, max=128),
    retry=retry_if_exception(is_rate_limit_error),
    reraise=True
)
def call_openai(messages):
    # the newest OpenAI model is "gpt-5" which was released August 7, 2025.
    # do not change this unless explicitly requested by the user
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        response_format={"type": "json_object"},
        max_completion_tokens=8192
    )
    return response.choices[0].message.content


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/judge', methods=['POST'])
def judge():
    data = request.json
    history = data.get('history', [])
    new_confession = data.get('confession', '')
    current_player = data.get('current_player', 'A')

    messages = [{"role": "system", "content": JUDGE_PROMPT}]

    for entry in history:
        messages.append({"role": "user", "content": f"プレイヤー{entry['player']}の告白: {entry['confession']}"})
        if entry.get('judge_comment'):
            messages.append({"role": "assistant", "content": json.dumps({"judge_comment": entry['judge_comment'], "is_over": False, "winner": None}, ensure_ascii=False)})

    messages.append({"role": "user", "content": f"プレイヤー{current_player}の告白: {new_confession}"})

    if not new_confession or not new_confession.strip():
        return jsonify({"error": "告白が空です"}), 400

    if current_player not in ('A', 'B'):
        return jsonify({"error": "無効なプレイヤー"}), 400

    try:
        result_text = call_openai(messages)
        result = json.loads(result_text)

        if "judge_comment" not in result or "is_over" not in result:
            return jsonify({"error": "審判官の応答が不正でした。もう一度お試しください。"}), 500

        return jsonify(result)
    except json.JSONDecodeError:
        return jsonify({"error": "審判官の応答を解析できませんでした。もう一度お試しください。"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    if not AI_INTEGRATIONS_OPENAI_API_KEY or not AI_INTEGRATIONS_OPENAI_BASE_URL:
        print("WARNING: AI_INTEGRATIONS_OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_BASE_URL is not set.")
        print("The OpenAI integration may not work correctly.")
    app.run(host='0.0.0.0', port=5000)
