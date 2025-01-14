import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { Document } from '@langchain/core/documents';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Message } from '../../components/types';

interface MessageMetadata {
  messageId: number;
  userId: string;
  username: string;
  channelId: number;
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

  const docs = messages.map(message => 
    new Document({
      pageContent: message.content,
      metadata: {
        messageId: message.id,
        userId: message.user_id,
        username: message.username,
        channelId: message.channel_id,
        timestamp: message.created_at
      } as MessageMetadata
    })
  );

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, { 
    pineconeIndex: index,
    textKey: 'text',
    namespace: messages[0].channel_id.toString()
  });

  for (const message of messages) {
    await index.deleteOne(message.id.toString());
  }

  await vectorStore.addDocuments(docs);
};

export const queryMessages = async (query: string) => {
  const pinecone = await initPinecone();
  const index = pinecone.Index(process.env.PINECONE_INDEX!);
  
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY
  });

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
  });

  const results = await vectorStore.similaritySearch(query, 10);

  const uniqueResults = results.filter((result, index, self) => {
    const currentMetadata = result.metadata as MessageMetadata;
    return index === self.findIndex((r) => {
      const rMetadata = r.metadata as MessageMetadata;
      return currentMetadata.messageId === rMetadata.messageId;
    });
  });

  return uniqueResults.slice(0, 5);
};

export const generateAIResponse = async (query: string, channelId: number) => {
  const pinecone = await initPinecone();
  const index = pinecone.Index(process.env.PINECONE_INDEX!);
  
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY
  });

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace: channelId.toString()
  });

  const contextResults = await vectorStore.similaritySearch(query, 5);
  
  const context = contextResults
    .map(result => `${result.metadata.username}: ${result.pageContent}`)
    .join('\n');

  const chat = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    modelName: 'gpt-3.5-turbo'
  });

  const prompt = `Based on the following chat context:\n\n${context}\n\nQuestion: ${query}\n\nPlease provide a helpful response that accurately reflects the conversation history. If the context doesn't contain relevant information, acknowledge that and provide a general response.`;

  const messages = [
    new SystemMessage("You are a helpful AI assistant in a chat application. You help users by providing information based on the chat history and answering their questions."),
    new HumanMessage(prompt)
  ];

  const response = await chat.invoke(messages);

  return response.text || "I couldn't generate a response.";
}; 