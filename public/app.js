// Get elements
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');

// Initialize userId from localStorage or generate a new one
let userId = localStorage.getItem('studai_session');
// Display session ID in the UI (if applicable)
if (document.getElementById('sessionKeyDisplay')) {
    if (userId) {
        document.getElementById('sessionKeyDisplay').textContent = userId;
    } else {
        document.getElementById('sessionKeyDisplay').textContent = 'null';
    }
}

// Function to add a message to the chat
function addMessage(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    messageElement.textContent = text;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll to bottom
}

// Function to send a message
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Add user message to the chat
    addMessage(message, 'user');
    userInput.value = '';

    try {
        // Send message to the server
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, userId }) // Include userId in the request
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        // Get AI response and add it to the chat
        const data = await response.json();
        addMessage(data.response, 'ai');
    } catch (error) {
        console.error('Error:', error);
        addMessage('⚠️ Could not connect to the AI service', 'error');
    }
}

// Event listener for the send button
document.querySelector('.chat-input button').addEventListener('click', sendMessage);

// Event listener for pressing Enter in the input field
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});