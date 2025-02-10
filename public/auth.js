function handleStartSession() {
    
    const sessionKey = document.getElementById('sessionKeyInput').value.trim();

    if (sessionKey) {
        // Initialize existing session key

        localStorage.setItem('studai_session', sessionKey);
        redirectToChat();
    }
}

function redirectToChat() {
    window.location.href = '/chat';
}

document.getElementById('sessionKeyInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        handleStartSession(); // Trigger the session start function
    }
});
