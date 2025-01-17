import { NextResponse } from 'next/server';
import { indexMessages, generateAIResponse, processPDF, queryMessages, generateAIResponseWithUserContext } from '../utils/ragUtils.server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'index') {
      await indexMessages(body.messages);
      return NextResponse.json({ success: true });
    } 
    else if (action === 'generate') {
      const response = await generateAIResponse(body.query, body.channelId);
      return NextResponse.json({ response });
    }
    else if (action === 'generateDM') {
      const response = await generateAIResponseWithUserContext(
        body.query,
        body.otherUserId,
        body.botPrompt
      );
      return NextResponse.json({ response });
    }
    else if (action === 'processPDF') {
      const { filePath, fileId, fileName, channelId, uploaderId, uploaderName } = body;
      const numChunks = await processPDF(filePath, fileId, fileName, channelId, uploaderId, uploaderName);
      return NextResponse.json({ success: true, numChunks });
    }
    else if (action === 'search') {
      const results = await queryMessages(body.query, body.channelId);
      return NextResponse.json({ results });
    }
    else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in AI route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 