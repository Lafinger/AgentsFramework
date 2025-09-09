// Global state management
let userToken = '';        // User authentication token (for creating sessions)
let sessionToken = '';     // Session token (for chat operations)
let currentSessionId = '';
let selectedSession = null; // Currently selected session object
let allSessions = [];      // Store all user sessions
let chatMessages = [];
let isStreaming = false;

// Utility functions
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    statusElement.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusElement.classList.add('hidden');
    }, 5000);
}

function getApiUrl() {
    return document.getElementById('apiUrl').value || 'http://localhost:8000';
}

function getAuthHeaders(useSessionToken = false) {
    // For chat operations, use session token; for user operations, use user token
    const token = useSessionToken ? sessionToken : (userToken || sessionToken);
    
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function getUserAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
    };
}

function getSessionAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
    };
}

function updateUserToken(token) {
    userToken = token;
    document.getElementById('sessionToken').value = token;
    showStatus('User authenticated! Create a session to start chatting.', 'success');
}

function updateSessionToken(token, sessionId) {
    sessionToken = token;
    currentSessionId = sessionId;
    document.getElementById('chatToken').value = token;
    document.getElementById('historyToken').value = token;
    showStatus(`Session created! ID: ${sessionId}`, 'success');
}

function displayResponse(elementId, data, isError = false) {
    const element = document.getElementById(elementId);
    if (isError) {
        element.style.color = '#dc3545';
    } else {
        element.style.color = '#28a745';
    }
    element.textContent = JSON.stringify(data, null, 2);
}

// Tab management
function showSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
    
    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected section and activate tab
    document.getElementById(sectionName + '-section').classList.add('active');
    event.target.classList.add('active');
}

// System Health API calls
async function checkHealth() {
    try {
        showStatus('Checking system health...', 'info');
        const response = await fetch(`${getApiUrl()}/health`);
        const data = await response.json();
        
        if (response.ok) {
            showStatus('System health check completed successfully!', 'success');
            displayResponse('system-response', data);
        } else {
            showStatus('Health check returned an error', 'error');
            displayResponse('system-response', data, true);
        }
    } catch (error) {
        showStatus('Failed to connect to the server', 'error');
        displayResponse('system-response', { error: error.message }, true);
    }
}

async function getRootInfo() {
    try {
        showStatus('Getting root API information...', 'info');
        const response = await fetch(`${getApiUrl()}/`);
        const data = await response.json();
        
        if (response.ok) {
            showStatus('Root API information retrieved!', 'success');
            displayResponse('system-response', data);
        } else {
            showStatus('Failed to get root information', 'error');
            displayResponse('system-response', data, true);
        }
    } catch (error) {
        showStatus('Failed to connect to the server', 'error');
        displayResponse('system-response', { error: error.message }, true);
    }
}

async function getApiHealth() {
    try {
        showStatus('Checking API v1 health...', 'info');
        const response = await fetch(`${getApiUrl()}/api/v1/health`);
        const data = await response.json();
        
        if (response.ok) {
            showStatus('API health check completed!', 'success');
            displayResponse('system-response', data);
        } else {
            showStatus('API health check failed', 'error');
            displayResponse('system-response', data, true);
        }
    } catch (error) {
        showStatus('Failed to connect to API', 'error');
        displayResponse('system-response', { error: error.message }, true);
    }
}

// Authentication API calls
async function registerUser() {
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    if (!email || !password) {
        showStatus('Please fill in all registration fields', 'error');
        return;
    }
    
    try {
        showStatus('Registering user...', 'info');
        const response = await fetch(`${getApiUrl()}/api/v1/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatus('User registered successfully!', 'success');
            updateUserToken(data.token.access_token);
            displayResponse('auth-response', data);
        } else {
            showStatus('Registration failed', 'error');
            displayResponse('auth-response', data, true);
        }
    } catch (error) {
        showStatus('Registration request failed', 'error');
        displayResponse('auth-response', { error: error.message }, true);
    }
}

async function loginUser() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showStatus('Please fill in all login fields', 'error');
        return;
    }
    
    try {
        showStatus('Logging in...', 'info');
        
        // Create form data for login
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);
        
        const response = await fetch(`${getApiUrl()}/api/v1/auth/login`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatus('Login successful!', 'success');
            updateUserToken(data.access_token);
            displayResponse('auth-response', data);
        } else {
            showStatus('Login failed', 'error');
            displayResponse('auth-response', data, true);
        }
    } catch (error) {
        showStatus('Login request failed', 'error');
        displayResponse('auth-response', { error: error.message }, true);
    }
}

// Session Management API calls
async function createSession() {
    if (!userToken) {
        showStatus('Please login first to create a session', 'error');
        return;
    }
    
    try {
        showStatus('Creating new session...', 'info');
        const response = await fetch(`${getApiUrl()}/api/v1/auth/session`, {
            method: 'POST',
            headers: getUserAuthHeaders()
        });
        
        const data = await response.json();
        
        if (response.ok) {
            updateSessionToken(data.token.access_token, data.session_id);
            displayResponse('sessions-response', data);
            getSessions(); // Refresh sessions list
        } else {
            showStatus('Failed to create session', 'error');
            displayResponse('sessions-response', data, true);
        }
    } catch (error) {
        showStatus('Session creation request failed', 'error');
        displayResponse('sessions-response', { error: error.message }, true);
    }
}

async function getSessions() {
    if (!userToken) {
        showStatus('Please login first to get sessions', 'error');
        return;
    }
    
    try {
        showStatus('Getting all sessions...', 'info');
        const response = await fetch(`${getApiUrl()}/api/v1/auth/sessions`, {
            headers: getUserAuthHeaders()
        });
        
        const data = await response.json();
        
        if (response.ok) {
            allSessions = data; // Store sessions globally
            showStatus('Sessions retrieved successfully!', 'success');
            displayResponse('sessions-response', data);
            displaySessionsList(data);
        } else {
            showStatus('Failed to get sessions', 'error');
            displayResponse('sessions-response', data, true);
        }
    } catch (error) {
        showStatus('Get sessions request failed', 'error');
        displayResponse('sessions-response', { error: error.message }, true);
    }
}

function displaySessionsList(sessions) {
    const container = document.getElementById('sessionsContainer');
    container.innerHTML = '';
    
    if (!sessions || sessions.length === 0) {
        container.innerHTML = '<p>No sessions found</p>';
        return;
    }
    
    sessions.forEach(session => {
        const sessionDiv = document.createElement('div');
        sessionDiv.className = 'session-item';
        sessionDiv.innerHTML = `
            <div class="session-info">
                <strong>ID:</strong> ${session.session_id}<br>
                <strong>Name:</strong> <span id="session-name-${session.session_id}">${session.name || 'Unnamed'}</span><br>
                <small>Click to select and use for chat</small>
                <input type="text" id="session-name-input-${session.session_id}" class="session-name-input hidden" value="${session.name || ''}" placeholder="Enter session name">
            </div>
            <div class="session-actions">
                                <button class="btn btn-small" id="edit-btn-${session.session_id}" onclick="startEditSessionName('${session.session_id}', '${session.name || ''}')">Edit Name</button>
                <button class="btn btn-small success hidden" id="save-btn-${session.session_id}" onclick="saveSessionName('${session.session_id}')">Save</button>
                <button class="btn btn-small hidden" id="cancel-btn-${session.session_id}" onclick="cancelEditSessionName('${session.session_id}', '${session.name || ''}')">Cancel</button>
                <button class="btn btn-small danger" onclick="deleteSelectedSession('${session.session_id}', '${session.name || 'Unnamed'}')">Delete</button>
            </div>
        `;
        
        // When a session item is clicked (but not a button or input inside it)
        sessionDiv.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && !e.target.closest('.session-actions')) {
                // Highlight the clicked session
                document.querySelectorAll('.session-item').forEach(item => item.classList.remove('active'));
                sessionDiv.classList.add('active');
                
                // Prepare session and switch to chat view
                selectSessionAndGoToChat(session);
            }
        };
        
        container.appendChild(sessionDiv);
    });
}

// New optimized session management functions
async function selectSessionAndGoToChat(session) {
    if (!userToken) {
        showStatus('Please login first', 'error');
        return;
    }

    // The session object from getSessions should already have a valid token.
    if (!session || !session.session_id || !session.token || !session.token.access_token) {
        showStatus('Invalid session data. Please refresh the session list.', 'error');
        getSessions(); // Attempt to refresh the list automatically
        return;
    }

    try {
        const sessionName = session.name || 'Unnamed';
        showStatus(`Preparing session ${sessionName} for chat...`, 'info');

        // Use the token and ID directly from the selected session object
        sessionToken = session.token.access_token;
        currentSessionId = session.session_id;

        // Update UI fields
        document.getElementById('chatToken').value = sessionToken;
        document.getElementById('historyToken').value = sessionToken;

        showStatus(`Session ${sessionName} is ready for chat.`, 'success');

        // Switch to the chat tab by simulating a click
        const chatTabButton = Array.from(document.querySelectorAll('.tab')).find(tab => tab.textContent.trim() === 'Chat');
        if (chatTabButton) {
            chatTabButton.click();
        } else {
            // Fallback if the button isn't found by its text content
            showSection('chat'); 
            console.error("Chat tab button not found, used fallback to show section.");
        }

    } catch (error) {
        showStatus(`Error preparing session for chat: ${error.message}`, 'error');
        console.error('Error in selectSessionAndGoToChat:', error);
    }
}

async function deleteSelectedSession(sessionId, sessionName) {
    if (!userToken) {
        showStatus('Please login first', 'error');
        return;
    }
    
    // Handle empty session names by providing a default name
    const displayName = sessionName && sessionName !== 'Unnamed' ? sessionName : 'Unnamed Session';
    
    if (!confirm(`Are you sure you want to delete session "${displayName}"?`)) {
        return;
    }
    
    try {
        showStatus('Deleting session...', 'info');
        
        // Use user token to delete any session that belongs to the user
        const deleteResponse = await fetch(`${getApiUrl()}/api/v1/auth/session/${sessionId}`, {
            method: 'DELETE',
            headers: getUserAuthHeaders()
        });
        
        if (deleteResponse.ok) {
            showStatus(`Session "${sessionName}" deleted successfully!`, 'success');
            
            // Refresh sessions list
            getSessions();
            
            // Clear selected session if it was the deleted one
            if (selectedSession && selectedSession.session_id === sessionId) {
                selectedSession = null;
            }
            
            // Clear chat session if it was the deleted one
            if (currentSessionId === sessionId) {
                currentSessionId = '';
                sessionToken = '';
                document.getElementById('chatToken').value = '';
                document.getElementById('historyToken').value = '';
            }
            
        } else {
            const errorData = await deleteResponse.json();
            showStatus(`Failed to delete session "${sessionName}": ${errorData.detail || 'Unknown error'}`, 'error');
        }
        
    } catch (error) {
        showStatus(`Error deleting session: ${error.message}`, 'error');
    }
}

// Session name update function - simplified for future use
async function updateSessionNameById(sessionId, newName) {
    if (!sessionId || !newName) {
        showStatus('Session ID and new name are required', 'error');
        return false;
    }
    
    try {
        showStatus('Updating session name...', 'info');
        const response = await fetch(`${getApiUrl()}/api/v1/auth/session/${sessionId}/name`, {
            method: 'PATCH',
            headers: getUserAuthHeaders(),
            body: JSON.stringify({ name: newName })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatus('Session name updated successfully!', 'success');
            getSessions(); // Refresh sessions list
            return true;
        } else {
            showStatus('Failed to update session name', 'error');
            return false;
        }
    } catch (error) {
        showStatus('Update session request failed', 'error');
        return false;
    }
}


// Chat API calls
function addMessageToChat(role, content, isStreaming = false) {
    const chatMessagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    if (isStreaming) {
        messageDiv.innerHTML = `<div class="streaming-indicator pulse">AI is thinking...</div><div class="message-content">${content}</div>`;
    } else {
        messageDiv.textContent = content;
    }
    
    chatMessagesContainer.appendChild(messageDiv);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    
    return messageDiv;
}

async function sendMessage() {
    const messageContent = document.getElementById('chatInput').value;
    
    if (!messageContent.trim()) {
        showStatus('Please enter a message', 'error');
        return;
    }
    
    if (!sessionToken) {
        showStatus('Please create a session first to start chatting', 'error');
        return;
    }
    
    // Add user message to chat
    addMessageToChat('user', messageContent);
    chatMessages.push({ role: 'user', content: messageContent });
    
    // Clear input
    document.getElementById('chatInput').value = '';
    
    try {
        showStatus('Sending message...', 'info');
        const response = await fetch(`${getApiUrl()}/api/v1/chatbot/chat`, {
            method: 'POST',
            headers: getSessionAuthHeaders(),
            body: JSON.stringify({ messages: chatMessages })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatus('Message sent successfully!', 'success');
            // Add assistant response to chat
            if (data.messages && data.messages.length > 0) {
                const lastMessage = data.messages[data.messages.length - 1];
                if (lastMessage.role === 'assistant') {
                    addMessageToChat('assistant', lastMessage.content);
                    chatMessages.push(lastMessage);
                }
            }
        } else {
            showStatus('Failed to send message', 'error');
            addMessageToChat('system', `Error: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        showStatus('Send message request failed', 'error');
        addMessageToChat('system', `Error: ${error.message}`);
    }
}

async function sendStreamMessage() {
    const messageContent = document.getElementById('chatInput').value;
    
    if (!messageContent.trim()) {
        showStatus('Please enter a message', 'error');
        return;
    }
    
    if (!sessionToken) {
        showStatus('Please create a session first to start chatting', 'error');
        return;
    }
    
    if (isStreaming) {
        showStatus('Already streaming a message, please wait...', 'error');
        return;
    }
    
    // Add user message to chat
    addMessageToChat('user', messageContent);
    chatMessages.push({ role: 'user', content: messageContent });
    
    // Clear input
    document.getElementById('chatInput').value = '';
    
    // Add streaming placeholder
    const streamingMessage = addMessageToChat('assistant', '', true);
    const contentDiv = streamingMessage.querySelector('.message-content');
    
    isStreaming = true;
    
    try {
        showStatus('Starting stream...', 'info');
        const response = await fetch(`${getApiUrl()}/api/v1/chatbot/chat/stream`, {
            method: 'POST',
            headers: getSessionAuthHeaders(),
            body: JSON.stringify({ messages: chatMessages })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                break;
            }
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonData = JSON.parse(line.substring(6));
                        if (jsonData.content) {
                            accumulatedContent += jsonData.content;
                            contentDiv.textContent = accumulatedContent;
                        }
                        if (jsonData.done) {
                            // Remove streaming indicator
                            const indicator = streamingMessage.querySelector('.streaming-indicator');
                            if (indicator) {
                                indicator.remove();
                            }
                            streamingMessage.className = 'message assistant';
                            chatMessages.push({ role: 'assistant', content: accumulatedContent });
                            showStatus('Stream completed!', 'success');
                            isStreaming = false;
                            return;
                        }
                    } catch (e) {
                        console.error('Error parsing stream data:', e);
                    }
                }
            }
        }
        
        isStreaming = false;
    } catch (error) {
        showStatus('Stream request failed', 'error');
        streamingMessage.textContent = `Stream Error: ${error.message}`;
        streamingMessage.className = 'message system';
        isStreaming = false;
    }
}

function clearChat() {
    chatMessages = [];
    const chatMessagesContainer = document.getElementById('chatMessages');
    chatMessagesContainer.innerHTML = '<div class="message system">Chat cleared. Start a new conversation!</div>';
    showStatus('Chat cleared', 'success');
}

// Message History API calls
async function getMessageHistory() {
    if (!sessionToken) {
        showStatus('Please create a session first to get message history', 'error');
        return;
    }
    
    try {
        showStatus('Getting message history...', 'info');
        const response = await fetch(`${getApiUrl()}/api/v1/chatbot/messages`, {
            headers: getSessionAuthHeaders()
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatus('Message history retrieved!', 'success');
            displayResponse('history-response', data);
            
            // Also display in a more readable format
            if (data.messages && data.messages.length > 0) {
                let historyText = "=== MESSAGE HISTORY ===\n\n";
                data.messages.forEach((msg, index) => {
                    historyText += `${index + 1}. [${msg.role.toUpperCase()}]: ${msg.content}\n\n`;
                });
                document.getElementById('history-response').textContent = historyText + "\n" + JSON.stringify(data, null, 2);
            }
        } else {
            showStatus('Failed to get message history', 'error');
            displayResponse('history-response', data, true);
        }
    } catch (error) {
        showStatus('Get history request failed', 'error');
        displayResponse('history-response', { error: error.message }, true);
    }
}

async function clearMessageHistory() {
    if (!confirm('Are you sure you want to clear all message history?')) {
        return;
    }
    
    try {
        showStatus('Clearing message history...', 'info');
        // This would depend on if there's a clear endpoint, for now just show a placeholder
        showStatus('Message history clearing not implemented in API', 'info');
        displayResponse('history-response', { message: 'Clear history endpoint not available' });
    } catch (error) {
        showStatus('Clear history request failed', 'error');
        displayResponse('history-response', { error: error.message }, true);
    }
}

// Session name editing functions
function startEditSessionName(sessionId, currentName) {
    // Hide the display name and show the input field
    document.getElementById(`session-name-${sessionId}`).classList.add('hidden');
    const inputField = document.getElementById(`session-name-input-${sessionId}`);
    inputField.classList.remove('hidden');
    inputField.value = currentName;
    inputField.focus();
    
    // Hide edit button, show save/cancel buttons
    document.getElementById(`edit-btn-${sessionId}`).classList.add('hidden');
    document.getElementById(`save-btn-${sessionId}`).classList.remove('hidden');
    document.getElementById(`cancel-btn-${sessionId}`).classList.remove('hidden');
}

function cancelEditSessionName(sessionId, originalName) {
    // Hide the input field and show the display name
    document.getElementById(`session-name-input-${sessionId}`).classList.add('hidden');
    document.getElementById(`session-name-${sessionId}`).classList.remove('hidden');
    
    // Show edit button, hide save/cancel buttons
    document.getElementById(`edit-btn-${sessionId}`).classList.remove('hidden');
    document.getElementById(`save-btn-${sessionId}`).classList.add('hidden');
    document.getElementById(`cancel-btn-${sessionId}`).classList.add('hidden');
    
    // Reset input value to original
    document.getElementById(`session-name-input-${sessionId}`).value = originalName;
}

async function saveSessionName(sessionId) {
    const newName = document.getElementById(`session-name-input-${sessionId}`).value.trim();
    
    if (!newName) {
        showStatus('Session name cannot be empty', 'error');
        return;
    }
    
    if (!userToken) {
        showStatus('Please login first', 'error');
        return;
    }
    
    try {
        showStatus('Updating session name...', 'info');
        
        const formData = new FormData();
        formData.append('name', newName);
        
        const response = await fetch(`${getApiUrl()}/api/v1/auth/session/${sessionId}/name`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${userToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatus('Session name updated successfully!', 'success');
            
            // Update the display
            document.getElementById(`session-name-${sessionId}`).textContent = newName;
            cancelEditSessionName(sessionId, newName);
            
            // Refresh sessions list to get updated data
            setTimeout(() => getSessions(), 500);
        } else {
            showStatus(`Failed to update session name: ${data.detail || 'Unknown error'}`, 'error');
            cancelEditSessionName(sessionId, document.getElementById(`session-name-${sessionId}`).textContent);
        }
    } catch (error) {
        showStatus(`Error updating session name: ${error.message}`, 'error');
        cancelEditSessionName(sessionId, document.getElementById(`session-name-${sessionId}`).textContent);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    showStatus('Application loaded successfully! Start by checking system health.', 'success');
    
    // Auto-check health on load
    setTimeout(() => {
        checkHealth();
    }, 1000);
    
    // Setup keyboard shortcuts
    document.getElementById('chatInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            sendMessage();
        }
    });
    
    // Setup form enter key handlers
    const enterKeyInputs = ['registerPassword', 'loginPassword'];
    enterKeyInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    if (inputId.includes('register')) {
                        registerUser();
                    } else if (inputId.includes('login')) {
                        loginUser();
                    }
                }
            });
        }
    });
});