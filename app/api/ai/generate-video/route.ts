import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!process.env.DID_API_KEY) {
      return NextResponse.json({ error: 'D-ID API key not configured' }, { status: 500 });
    }

    // First API call - Create video
    const createResponse = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: process.env.DID_API_KEY
      },
      body: JSON.stringify({
        //source_url: 'https://tahzloutgztrjefnzelo.supabase.co/storage/v1/object/public/user-content/avatars/511fd786-602d-4dbc-8061-eee7f3c53a03-0.32411510045768144.jpeg',
        //source_url: 'https://img.freepik.com/free-photo/bearded-man-listening-music-through-earphones-portrait_53876-148059.jpg?t=st=1737250820~exp=1737254420~hmac=fe7d542bb3abb86f138c555a6cb431b44a6fdc33787c07a8641f269ee50b2fcc&w=1800',
        //source_url: 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg',
        source_url: 'https://i.ibb.co/wrjD9fm/IMG-2541.jpg',
        script: {
          type: 'text',
          subtitles: 'false',
          provider: {
            type: 'microsoft',
            voice_id: 'en-US-GuyNeural',
          },
          input: text
        }
//        persist: 'true'
      })
    });

    if (!createResponse.ok) {
      console.error('Create failed:', await createResponse.text());
      return NextResponse.json({ error: 'Failed to create video' }, { status: createResponse.status });
    }

    const { id } = await createResponse.json();
    console.log('Created video with ID:', id);

    // Second API call - Get video
    let attempts = 0;
    const maxAttempts = 180;

    while (attempts < maxAttempts) {
      const getResponse = await fetch(`https://api.d-id.com/talks/${id}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: process.env.DID_API_KEY
        }
      });

      if (!getResponse.ok) {
        console.error('Get failed:', await getResponse.text());
        return NextResponse.json({ error: 'Failed to get video' }, { status: getResponse.status });
      }

      const data = await getResponse.json();
      console.log('Video status:', data.status);

      if (data.status === 'done' && data.result_url) {
        return NextResponse.json({ videoUrl: data.result_url });
      }

      if (data.status === 'failed') {
        return NextResponse.json({ error: 'Video generation failed' }, { status: 500 });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    return NextResponse.json({ error: 'Video generation timed out' }, { status: 500 });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 