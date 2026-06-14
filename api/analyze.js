import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

const SYSTEM_PROMPT = `你是一个专业的美妆文案审查助手。请分析以下美妆相关文本，检测以下问题：

1. 错别字和语法错误
2. 违禁词和合规风险（如虚假宣传、夸大功效等）
3. 用词优化建议
4. 文案改进建议

请以JSON格式返回分析结果：
{
    "errors": [{"type": "typo/forbidden", "text": "问题文本", "suggestion": "建议", "reason": "原因"}],
    "suggestions": [{"original": "原文", "improved": "改进版", "reason": "改进原因"}],
    "compliance": {"score": 85, "issues": ["问题列表"]},
    "resources": ["相关资料推荐"],
    "improved_full_text": "完整修改后的文案"
}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: '请提供要分析的文本' });

    const completion = await openai.chat.completions.create({
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `请分析这段美妆文案：\n\n${text}` },
      ],
      temperature: 0.7,
    });

    const data = JSON.parse(completion.choices[0].message.content);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({ error: 'AI分析服务暂时不可用' });
  }
}
