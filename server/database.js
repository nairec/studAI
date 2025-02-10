import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { MongoClient } from "mongodb";
import { randomUUID } from 'crypto';

const uri = "mongodb+srv://admin:p5e35scMnAl8o0Pm@studai.mev5s.mongodb.net/?retryWrites=true&w=majority&appName=studAi";
const client = new MongoClient(uri);

const supabaseUrl = 'https://wpwhkbtyyqyscfvfulgw.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE_NAME = 'facts';

async function getCollection(collectionName) {
  try {
    await client.connect();
    console.log(`Connected to MongoDB Atlas for ${collectionName}`);
    const db = client.db("studAi");
    return db.collection(collectionName);
  } catch (err) {
    console.error(`Error connecting to MongoDB ${collectionName}:`, err);
    throw err;
  }
}

export async function connect() {
  try {
      await client.connect();
      console.log("Connected to MongoDB Atlas");
      const db = client.db("studAi");
      const collection = db.collection("knowledge_base");
      return collection;
  } catch (err) {
      console.error("Error connecting to MongoDB:", err);
  }
}

async function connectUsers() {
  return getCollection('users');
}

export async function saveKnowledge(text, embedding) {
  const collection = await connect();
  await collection.insertOne({ text, embedding, timestamp: new Date() });
  console.log("Knowledge saved!");
}

export async function findSimilarKnowledge(queryEmbedding) {
  const collection = await connect();
  const results = await collection.aggregate([
      {
          $vectorSearch: {
              queryVector: queryEmbedding,
              path: "embedding",
              numCandidates: 100,
              limit: 5,
              index: "knowledge_base"
          }
      }
  ]).toArray();
  return results;
}

// Function to add a new fact
export async function addFact(keyword, fact) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([{ keyword, fact }])
    .select();

    if (error){
      console.log(error);
      throw error;
    } 
  return data;
}

// Function to get facts by keyword
export async function getFacts(keyword) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('fact')
    .ilike('keyword', `%${keyword}%`);

  if (error){
    console.log(error);
    throw error;
  } 
  return data;
}

export function getUserId() {
  
  const userId = generateUserId();
  
  return userId;
}

function generateUserId() {
  if (randomUUID) {
    return randomUUID();
  }

  // Method 2: Generate a timestamp-based ID with random components
  const timestamp = new Date().getTime();
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}`;
}

export async function updateUserUsage(userId, message) {
  try {
    const collection = await connectUsers();
    const today = new Date().toISOString().split('T')[0];

    const updateResult = await collection.updateOne(
      { userId },
      [
        {
          $set: {
            lastMessageDate: today,
            messageCount: {
              $cond: {
                if: { $eq: ["$lastMessageDate", today] },
                then: { $add: ["$messageCount", 1] },
                else: 1
              }
            },
            messages: { $concatArrays: ["$messages", [message]] }
          }
        }
      ]
    );

    return updateResult;
  } catch (error) {
    console.error('Error updating user usage:', error);
    throw error;
  }
}

export async function getDailyMessageCount(userId) {
  try {
    const collection = await connectUsers();
    const user = await collection.findOne({ userId });
    if (!user) return 0;
    
    const today = new Date().toISOString().split('T')[0];
    return (user.lastMessageDate === today) ? user.messageCount : 0;
  } catch (error) {
    console.error('Error getting daily message count:', error);
    throw error;
  }
}

export async function initializeUser(userId) {
  try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Using upsert to either create new user or leave existing one unchanged
      const db = client.db("studAi");
      await db.collection('users').updateOne(
          { userId: userId },
          {
              $setOnInsert: {
                  userId: userId,
                  messages: [],
                  messageCount: 0,
                  lastMessageDate: today
              }
          },
          { upsert: true }
      );
      
      return userId;
  } catch (error) {
      console.error('Error initializing user:', error);
      throw error;
  }
}

export async function getUserMessages(userId) {
  try {
      const collection = await connectUsers();
      const user = await collection.findOne({ userId });
      if (user && user.messages) {
        return user.messages.map(message => message.content);
      } else {
        return []; // Return an empty array if no messages are found
      }
  } catch (error) {
      console.error('Error fetching user messages:', error);
      throw error;
  }
}