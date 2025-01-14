import { NextResponse } from 'next/server';
import { generateAIResponse, indexMessages, queryMessages } from '../../utils/ragUtils';

export async function POST(req: Request) {
  try {
    const { action, query, channelId, messages } = await req.json();

    switch (action) {
      case 'generate':
        const response = await generateAIResponse(query, channelId);
        return NextResponse.json({ response });
      
      case 'index':
        await indexMessages(messages);
        return NextResponse.json({ success: true });
      
      case 'search':
        const results = await queryMessages(query);
        return NextResponse.json({ results });
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('AI API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 