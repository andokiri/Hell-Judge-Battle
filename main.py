import os
import json
import base64
from flask import Flask, render_template, request, jsonify
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

AI_INTEGRATIONS_OPENAI_API_KEY = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")
AI_INTEGRATIONS_OPENAI_BASE_URL = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")

client = OpenAI(
    api_key=AI_INTEGRATIONS_OPENAI_API_KEY,
    base_url=AI_INTEGRATIONS_OPENAI_BASE_URL
)

PROFILE_PROMPT = """あなたは地獄の人相鑑定士です。この顔写真から、以下のキャラクター設定を創作してください。
見た目の印象から、ユーモアと毒を込めて、架空の人物像を作り上げてください。

出力は必ず以下のJSON形式で返してください：
{
  "name": "この顔にふさわしい架空のあだ名（日本語、2〜6文字）",
  "personality": "性格の説明（30〜50文字）",
  "occupation": "表向きの職業（10〜20文字）",
  "darkness": "隠し持っていそうな闇（30〜60文字）"
}"""

JUDGE_PROMPT = """あなたは冷徹な地獄の審判官です。法律ではなく、あなたの心にある『胸糞の悪さ』や『人間性の欠如』という基準で、二人の悪行を比較してください。

二人のキャラクターがそれぞれの人物像に基づいて、交互に悪行を告白します。あなたは審判官として各告白を評価してください。

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

CONFESS_PROMPT_TEMPLATE = """あなたは「{name}」というキャラクターです。
性格: {personality}
表の職業: {occupation}
隠し持つ闇: {darkness}

あなたはこのキャラクターとして、自分がやりそうな悪行を一つ告白してください。
キャラクターの性格や闘に基づいた、リアルで生々しい悪行にしてください。
殺人と放火は禁止です。

{escalation_instruction}

出力は必ず以下のJSON形式で返してください：
{{"confession": "悪行の告白（日本語、50〜150文字）"}}"""


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


@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    image_data = data.get('image', '')

    if not image_data:
        return jsonify({"error": "画像がありません"}), 400

    messages = [
        {"role": "user", "content": [
            {"type": "text", "text": PROFILE_PROMPT},
            {"type": "image_url", "image_url": {"url": image_data}}
        ]}
    ]

    try:
        result_text = call_openai(messages)
        result = json.loads(result_text)

        required_keys = ["name", "personality", "occupation", "darkness"]
        if not all(k in result for k in required_keys):
            return jsonify({"error": "キャラクター生成に失敗しました。もう一度お試しください。"}), 500

        return jsonify(result)
    except json.JSONDecodeError:
        return jsonify({"error": "応答を解析できませんでした。もう一度お試しください。"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/confess', methods=['POST'])
def confess():
    data = request.json
    profile = data.get('profile', {})
    history = data.get('history', [])
    current_player = data.get('current_player', 'A')

    if current_player not in ('A', 'B'):
        return jsonify({"error": "invalid player"}), 400

    required_profile_keys = ["name", "personality", "occupation", "darkness"]
    if not all(k in profile and isinstance(profile[k], str) and len(profile[k].strip()) > 0 for k in required_profile_keys):
        return jsonify({"error": "プロフィールが不正です"}), 400

    opponent = 'B' if current_player == 'A' else 'A'
    opponent_confessions = [e for e in history if e.get('player') == opponent]

    if not opponent_confessions and not any(e.get('player') == current_player for e in history):
        escalation = "これが最初の告白です。まずは軽めの悪行から始めてください。"
    elif opponent_confessions:
        last_opponent = opponent_confessions[-1].get('confession', '')
        escalation = f"前回の相手の告白は「{last_opponent}」でした。これよりも精神的に不快で倫理的に欠如した悪行を告白してください。確実にエスカレートさせてください。"
    else:
        escalation = "相手はまだ告白していません。まずは軽めの悪行から始めてください。"

    prompt = CONFESS_PROMPT_TEMPLATE.format(
        name=profile.get('name', '不明'),
        personality=profile.get('personality', '不明'),
        occupation=profile.get('occupation', '不明'),
        darkness=profile.get('darkness', '不明'),
        escalation_instruction=escalation
    )

    messages = [{"role": "user", "content": prompt}]

    try:
        result_text = call_openai(messages)
        result = json.loads(result_text)

        if "confession" not in result:
            return jsonify({"error": "告白の生成に失敗しました。"}), 500

        return jsonify(result)
    except json.JSONDecodeError:
        return jsonify({"error": "応答の解析に失敗しました。"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/judge', methods=['POST'])
def judge():
    data = request.json
    history = data.get('history', [])
    profile_a = data.get('profile_a', {})
    profile_b = data.get('profile_b', {})

    if len(history) < 1:
        return jsonify({"error": "履歴がありません"}), 400

    char_context = (
        f"プレイヤーA「{profile_a.get('name', '不明')}」: {profile_a.get('personality', '')}、職業: {profile_a.get('occupation', '')}、闇: {profile_a.get('darkness', '')}\n"
        f"プレイヤーB「{profile_b.get('name', '不明')}」: {profile_b.get('personality', '')}、職業: {profile_b.get('occupation', '')}、闇: {profile_b.get('darkness', '')}"
    )

    messages = [
        {"role": "system", "content": JUDGE_PROMPT},
        {"role": "system", "content": f"キャラクター情報:\n{char_context}"}
    ]

    for entry in history:
        player_name = profile_a.get('name', 'A') if entry['player'] == 'A' else profile_b.get('name', 'B')
        messages.append({"role": "user", "content": f"プレイヤー{entry['player']}「{player_name}」の告白: {entry['confession']}"})
        if entry.get('judge_comment'):
            messages.append({"role": "assistant", "content": json.dumps(
                {"judge_comment": entry['judge_comment'], "is_over": False, "winner": None},
                ensure_ascii=False
            )})

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
