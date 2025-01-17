import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OpenAI API key is not configured');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const tts = {
  async generateSpeech(text: string) {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });
    
    const buffer = Buffer.from(await mp3.arrayBuffer());
    return buffer.toString('base64');
  }
}; 