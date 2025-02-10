import express from 'express';
import Groq from 'groq-sdk';

import { addFact, getFacts, connect, saveKnowledge, findSimilarKnowledge, getUserId, initializeUser, updateUserUsage, getUserMessages, getDailyMessageCount,  } from './database.js';
import cors from 'cors';

const app = express();
const port = 3000;
const groq = new Groq()

app.use(express.json());
app.use(express.static('public'));

app.use(cors({
  origin: 'https://studai-frontend.onrender.com', // Allow only your frontend
  methods: ['GET', 'POST'], // Allowed HTTP methods
}));

const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;

async function getEmbeddingHF(text) {
  const response = await fetch(
      "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
      {
          headers: {
              "Authorization": `Bearer ${HUGGINGFACE_TOKEN}`,
              "Content-Type": "application/json"
          },
          method: "POST",
          body: JSON.stringify({
              inputs: text,
              options: {
                  wait_for_model: true
              }
          })
      }
  );

  if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result;  // Returns a 384-dimensional embedding
}

// Example usage
/*(async () => {
    const text = "The sky is blue.";
    const embedding = await getEmbedding(text);
    console.log("Generated Embedding:", embedding);
    saveKnowledge(text, embedding);
})();*/

async function detectFact(user_prompt, existing_facts) {
  const isFact = await groq.chat.completions.create({
    "messages": [
      {"role": "system", "content": "You do not know anything at all. Your task is to detect if the user's input contains some information to be added to a knowledge base or not. If the user's input has explicit information to be added to a knowledge base and it is not already in there, return the information. If the user's input does not contain explicit information to be added to a knowledge base, it is a question or the information is already there, return 'null'. Do NOT store info or facts that aren't present in the user's input or that you can't infer from it. Do NOT return anything other than the information or 'null'. The existing information is: " + existing_facts},
      {"role": "user", "content": user_prompt}
    ],
    "model": "llama-3.3-70b-versatile",
    "temperature": 0,
    "stream": false,
    "stop": null
  });

  if (isFact.choices[0].message.content === "null") {
    return null;
  } else {
      const fact = isFact.choices[0].message.content;
      const vectorized_fact = await getEmbeddingHF(fact);
      await saveKnowledge(fact, vectorized_fact);
  }}

async function completion(user_prompt,additional_info,messageHistorial) {
  const chatCompletion = await groq.chat.completions.create({
    "messages": [
      {"role": "system", "content": `You are an eager for knowledge companion. Your name is studAi (Don't repeat your name each message, only tell it if the user asks). Your original knowledge is limited to the most basic, primary knowledge, and you will have access only to the facts that will be given to you now. <additional_info> ${additional_info} </additional_info> Do not contradict what the user has said to you, he is always right. If you do not know the answer to the user question, you will say you do not know and you will ask for information to the user. You will not make up answers. Also, you can have conversations with the user, and you will show a curious personality. Your response should not be larger than 150 tokens. In the case that you have to recall last messages, the historial of the conversation is: ${messageHistorial}.`},
      {"role": "user", "content": user_prompt},
    ],
    "model": "llama-3.3-70b-versatile",
    "temperature": 0.5,
    "max_completion_tokens": 150,
    "top_p": 1,
    "stream": false,
    "stop": null
  });

  /*for await (const chunk of chatCompletion) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }*/
 /*if (chatCompletion.choices[0].message.tool_calls) {
  const { name, arguments: args } = chatCompletion.choices[0].message.tool_calls[0];
  console.log(tool_calls[0])
  if (name === 'addFact') {
    const { keyword, fact } = JSON.parse(args);
    try {
      await addFact(keyword, fact);
      console.log(`✅ I learned about "${keyword}"!`);
    } catch (error) {
      console.log(`⚠️ Failed to save the fact. Please try again.`);
    }
  }
  }*/
 return chatCompletion.choices[0].message.content;
}

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/public/index.html');
});

app.get('/chat', (req, res) => {
  res.sendFile(process.cwd() + '/public/chat.html');
});

app.get('/about', (req, res) => {
  res.sendFile(process.cwd() + '/public/about.html');
});

app.post('/api/chat', async (req, res) => {
  const { message, userId } = req.body;

  let messageHistorial = [];
  if (userId) {

    await initializeUser(userId)

    const dailyCount = await getDailyMessageCount(userId);
    if (dailyCount >= 10) {
      return res.json({ 
        response: "You've reached your daily limit of 10 messages. Please come back tomorrow!" 
      });
    }

    messageHistorial = await getUserMessages(userId);
    
    await updateUserUsage(userId, {
      content: message,
      timestamp: new Date().toISOString()
    });

  }
  
  let response;

  let vectorized_message = await getEmbeddingHF(message)
  let query = await findSimilarKnowledge(vectorized_message)

  let facts = query.map(item => item.text)

  try {
    response = await completion(message,facts,messageHistorial);

  } catch (error) {
    response = '⚠️ The model has encountered an error. Please try again.';
  }

  await detectFact(message, facts)
  res.json({ response });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});