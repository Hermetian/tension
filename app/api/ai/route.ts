import { NextResponse } from 'next/server';
import { 
  indexMessages, 
  generateAIResponse, 
  generateAIResponseWithUserContext,
  processPDF,
  queryMessages 
} from '@/app/api/utils/ragUtils.server';
import { tts } from '@/app/api/utils/openai';
import { validateRequestBody, handleApiError } from '@/app/api/utils/validation';
import { Message } from '@/app/components/types';

// Request type definitions
interface BaseRequest {
  action: 'index' | 'generate' | 'generateDM' | 'processPDF' | 'search' | 'tts';
}

interface IndexRequest extends BaseRequest {
  action: 'index';
  messages: Message[];
}

interface GenerateRequest extends BaseRequest {
  action: 'generate';
  query: string;
  channelId: string;
}

interface GenerateDMRequest extends BaseRequest {
  action: 'generateDM';
  query: string;
  otherUserId: string;
  botPrompt: string;
}

interface ProcessPDFRequest extends BaseRequest {
  action: 'processPDF';
  filePath: string;
  fileId: string;
  fileName: string;
  channelId: string;
  uploaderId: string;
  uploaderName: string;
}

interface SearchRequest extends BaseRequest {
  action: 'search';
  query: string;
  channelId: string;
}

interface TTSRequest extends BaseRequest {
  action: 'tts';
  text: string;
}

type RequestType = IndexRequest | GenerateRequest | GenerateDMRequest | ProcessPDFRequest | SearchRequest | TTSRequest;

// Action handlers
const handlers: {
  [K in RequestType['action']]: (request: Extract<RequestType, { action: K }>) => Promise<unknown>
} = {
  async index(request: IndexRequest) {
    const { messages } = validateRequestBody<Omit<IndexRequest, 'action'>>(request, ['messages']);
    await indexMessages(messages);
    return { success: true };
  },

  async generate(request: GenerateRequest) {
    const { query, channelId } = validateRequestBody<Omit<GenerateRequest, 'action'>>(request, ['query', 'channelId']);
    const response = await generateAIResponse(query, parseInt(channelId, 10));
    return { response };
  },

  async generateDM(request: GenerateDMRequest) {
    const { query, otherUserId, botPrompt } = validateRequestBody<Omit<GenerateDMRequest, 'action'>>(
      request, 
      ['query', 'otherUserId', 'botPrompt']
    );
    const response = await generateAIResponseWithUserContext(query, otherUserId, botPrompt);
    return { response };
  },

  async processPDF(request: ProcessPDFRequest) {
    const validated = validateRequestBody<Omit<ProcessPDFRequest, 'action'>>(
      request,
      ['filePath', 'fileId', 'fileName', 'channelId', 'uploaderId', 'uploaderName']
    );
    
    const numChunks = await processPDF(
      validated.filePath,
      validated.fileId,
      validated.fileName,
      parseInt(validated.channelId, 10),
      validated.uploaderId,
      validated.uploaderName
    );
    
    return { success: true, numChunks };
  },

  async search(request: SearchRequest) {
    const { query, channelId } = validateRequestBody<Omit<SearchRequest, 'action'>>(request, ['query', 'channelId']);
    const results = await queryMessages(query, parseInt(channelId, 10));
    return { results };
  },

  async tts(request: TTSRequest) {
    const { text } = validateRequestBody<Omit<TTSRequest, 'action'>>(request, ['text']);
    const base64Audio = await tts.generateSpeech(text);
    return { audio: base64Audio };
  }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = validateRequestBody<BaseRequest>(body, ['action']);

    if (!(action in handlers)) {
      throw new Error(`Invalid action: ${action}`);
    }

    // Type assertion to ensure type safety while maintaining runtime flexibility
    const handler = handlers[action] as (request: RequestType) => Promise<unknown>;
    const result = await handler(body as RequestType);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
} 