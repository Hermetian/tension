// app/utils/ragUtils.ts
import { OpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { Document } from '@langchain/core/documents';

const initPinecone = async () => {
  const pinecone = new Pinecone({
    apiKey: process.env.NEXT_PUBLIC_PINECONE_API_KEY!
  });
  return pinecone;
};

export const indexMessages = async (messages: any[]) => {
  const pinecone = await initPinecone();
  const index = pinecone.Index(process.env.NEXT_PUBLIC_PINECONE_INDEX!);
  
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY
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
      }
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
  const index = pinecone.Index(process.env.NEXT_PUBLIC_PINECONE_INDEX!);
  
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY
  });

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
  });

  const results = await vectorStore.similaritySearch(query, 10);

  const uniqueResults = results.filter((result, index, self) =>
    index === self.findIndex((r) => 
      (r.metadata as any).messageId === (result.metadata as any).messageId
    )
  );

  return uniqueResults.slice(0, 5);
};