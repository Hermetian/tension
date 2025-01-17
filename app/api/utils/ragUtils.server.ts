import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { Document } from '@langchain/core/documents';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Message } from '@/app/components/types';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';

interface MessageMetadata {
  messageId: number;
  userId: string;
  username: string;
  channelId: number;
  timestamp: string;
}

interface PDFMetadata {
  fileId: string;
  fileName: string;
  channelId: number;
  uploaderId: string;
  uploaderName: string;
  pageNumber: number;
  timestamp: string;
}

const initPinecone = async () => {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
  });
  return pinecone;
};

export const indexMessages = async (messages: Message[]) => {
  const pinecone = await initPinecone();
  const index = pinecone.Index(process.env.PINECONE_INDEX!);
  
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY
  });

  // Split long messages
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
  });

  const allDocs: Document[] = [];
  for (const message of messages) {
    const splitTexts = await textSplitter.splitText(message.content);
    const docs = splitTexts.map((text, idx) => 
      new Document({
        pageContent: text,
        metadata: {
          messageId: message.id,
          userId: message.user_id,
          username: message.username,
          channelId: message.channel_id,
          timestamp: message.created_at,
          chunkIndex: idx
        } as MessageMetadata
      })
    );
    allDocs.push(...docs);
  }

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, { 
    pineconeIndex: index,
    namespace: messages[0].channel_id.toString()
  });

  for (const message of messages) {
    try {
      await index.deleteOne(message.id.toString());
    } catch (error) {
      console.error('Error deleting vector:', error);
    }
  }

  try {
    await vectorStore.addDocuments(allDocs);
  } catch (error) {
    console.error('Error adding documents:', error);
    throw new Error('Failed to index message');
  }
};

export const processPDF = async (
  fileUrl: string,
  fileId: string,
  fileName: string,
  channelId: number,
  uploaderId: string,
  uploaderName: string
) => {
  // Create a temporary file path
  const tempDir = os.tmpdir();
  const fileHash = createHash('md5').update(fileUrl).digest('hex');
  const tempFilePath = path.join(tempDir, `${fileHash}.pdf`);

  try {
    // Download the file
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Failed to download PDF');
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer));

    // Load and process the PDF
    const loader = new PDFLoader(tempFilePath, {
      splitPages: true
    });
    
    const docs = await loader.load();
    
    // Split documents into smaller chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    });
    
    const splitDocs = await textSplitter.splitDocuments(docs);
    
    // Add metadata to each chunk
    const processedDocs = splitDocs.map((doc: Document, index: number) => {
      return new Document({
        pageContent: doc.pageContent,
        metadata: {
          fileId,
          fileName,
          channelId,
          uploaderId,
          uploaderName,
          pageNumber: doc.metadata.pageNumber || index + 1,
          timestamp: new Date().toISOString()
        } as PDFMetadata
      });
    });

    const pinecone = await initPinecone();
    const index = pinecone.Index(process.env.PINECONE_INDEX!);
    
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: `pdf_${channelId}`
    });

    await vectorStore.addDocuments(processedDocs);
    
    return processedDocs.length;
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  } finally {
    // Clean up: delete the temporary file
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (error) {
      console.error('Error cleaning up temp file:', error);
    }
  }
};

export const queryMessages = async (query: string, channelId?: number) => {
  const pinecone = await initPinecone();
  const index = pinecone.Index(process.env.PINECONE_INDEX!);
  
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY
  });

  // Search in messages
  const messageVectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace: channelId?.toString()
  });

  const messageResults = await messageVectorStore.similaritySearch(query, 5);

  // Search in PDFs if channelId is provided
  let pdfResults: Document[] = [];
  if (channelId) {
    const pdfVectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: `pdf_${channelId}`
    });
    pdfResults = await pdfVectorStore.similaritySearch(query, 5);
  }

  // Combine and deduplicate results
  const allResults = [...messageResults, ...pdfResults];
  const uniqueResults = allResults.filter((result, index, self) => {
    if ('messageId' in result.metadata) {
      const currentMetadata = result.metadata as MessageMetadata;
      return index === self.findIndex((r) => {
        if ('messageId' in r.metadata) {
          const rMetadata = r.metadata as MessageMetadata;
          return currentMetadata.messageId === rMetadata.messageId;
        }
        return false;
      });
    } else {
      const currentMetadata = result.metadata as PDFMetadata;
      return index === self.findIndex((r) => {
        if (!('messageId' in r.metadata)) {
          const rMetadata = r.metadata as PDFMetadata;
          return currentMetadata.fileId === rMetadata.fileId && 
                 currentMetadata.pageNumber === rMetadata.pageNumber;
        }
        return false;
      });
    }
  });

  return uniqueResults.slice(0, 10);
};

export const generateAIResponse = async (query: string, channelId: number) => {
  const pinecone = await initPinecone();
  const index = pinecone.Index(process.env.PINECONE_INDEX!);
  
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY
  });

  // Search in messages
  const messageVectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace: channelId.toString()
  });

  const messageResults = await messageVectorStore.similaritySearch(query, 10);
  
  // Search in PDFs
  const pdfVectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace: `pdf_${channelId}`
  });
  const pdfResults = await pdfVectorStore.similaritySearch(query, 25);

  // Format context from both messages and PDFs
  const messageContext = messageResults
    .map(result => `${result.metadata.username}: ${result.pageContent}`)
    .join('\n');

  const pdfContext = pdfResults
    .map(result => {
      const metadata = result.metadata as PDFMetadata;
      return `[From PDF: ${metadata.fileName}, Page ${metadata.pageNumber}]: ${result.pageContent}`;
    })
    .join('\n');

  const chat = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    modelName: 'gpt-3.5-turbo-16k'
  });

  const prompt = `Based on the following context:

Chat Messages:
${messageContext}

PDF Content:
${pdfContext}

Question: ${query}

Please provide a helpful response that accurately reflects both the conversation history and PDF content. If referencing information from a PDF, mention which document it's from. If the context doesn't contain relevant information, acknowledge that and provide a general response.`;

  const messages = [
    new SystemMessage("You are a helpful AI assistant in a chat application. You help users by providing information based on both chat history and uploaded PDF documents. When referencing information from PDFs, specify which document you're quoting."),
    new HumanMessage(prompt)
  ];

  const response = await chat.invoke(messages);

  return response.text || "I couldn't generate a response.";
};

export const getUserMessages = async (userId: string) => {
  const pinecone = await initPinecone();
  const index = pinecone.Index(process.env.PINECONE_INDEX!);
  
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY
  });

  let allMessages: Document[] = [];
  
  // Search in channel messages
  const channelVectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace: 'channel_messages'
  });

  const channelMessages = await channelVectorStore.similaritySearch("", 1000, {
    filter: { userId }
  });
  
  // Search in DM messages
  const dmVectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace: 'dm_messages'
  });

  const dmMessages = await dmVectorStore.similaritySearch("", 1000, {
    filter: { userId }
  });

  allMessages = [...channelMessages, ...dmMessages];
  return allMessages;
};

export const generateAIResponseWithUserContext = async (query: string, otherUserId: string, botPrompt?: string) => {
  const pinecone = await initPinecone();
  const index = pinecone.Index(process.env.PINECONE_INDEX!);
  
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY
  });

  // Create vector store for similarity search
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, { 
    pineconeIndex: index
  });

  // Perform similarity search across all namespaces
  const similarityResults = await vectorStore.similaritySearch(query, 10);

  // Filter results to only include messages from the other user
  const relevantResults = similarityResults.filter(doc => 
    doc.metadata.userId === otherUserId
  );

  // Format context from relevant messages
  const messageContext = relevantResults
    .map(result => {
      const metadata = result.metadata as MessageMetadata | PDFMetadata;
      if ('fileName' in metadata) {
        // It's a PDF document
        return `[From PDF "${metadata.fileName}"]: ${result.pageContent}`;
      } else {
        // It's a message
        return `${metadata.username}: ${result.pageContent}`;
      }
    })
    .join('\n');

  const chat = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    modelName: 'gpt-3.5-turbo-16k'
  });

  const systemPrompt = botPrompt || "You are a helpful AI assistant in a chat application. You help users by providing information based on the conversation history.";

  const prompt = `Based on the following relevant context from the user's messages and files:

${messageContext}

Question: ${query}

Please provide a helpful response that accurately reflects the user's communication style and knowledge based on their message history. If the context contains relevant information from files or previous messages, incorporate that into your response.`;

  console.log('Generating AI response with:', {
    systemPrompt,
    messageContext: messageContext.slice(0, 200) + '...', // Log first 200 chars of context
    query
  });

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(prompt)
  ];

  const response = await chat.invoke(messages);

  return response.text || "I couldn't generate a response.";
}; 