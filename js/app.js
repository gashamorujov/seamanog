let appData = null;
let currentPage = 'home';
let currentExamCategory = null;
let currentExamTopic = null;
let currentQuestionIndex = 0;
let examQuestions = [];
let userAnswers = [];
let timerInterval = null;
let timerSeconds = 0;
let examStartTime = null;

// Load data
async function loadData() {
    try {
        const response = await fetch('data/questions_data.json');
        appData = await response.json();
        updateStats();
    } catch (e) {
        console.error('Failed to load data:', e);
    }
}

function updateStats() {
    if (!appData) return;
    let totalQ = 0, totalT = 0, totalP = 0;
    const categories = ['siravi', 'special', 'certdip'];
    const names = { siravi: 'Sıravi Heyət', special: 'Xüsusi Hazırlıq', certdip: 'Sertifikat/Diplom' };
    
    categories.forEach(cat => {
        const topics = appData[cat] || [];
        topics.forEach(t => {
            totalQ += t.count;
            totalT++;
            totalP++;
        });
    });
    
    document.getElementById('totalQuestions').textContent = totalQ.toLocaleString();
    document.getElementById('totalTopics').textContent = totalT;
    document.getElementById('totalPdfs').textContent = totalP;
    
    document.getElementById('siraviCount').textContent = `${appData.siravi?.length || 0} mövzu`;
    document.getElementById('specialCount').textContent = `${appData.special?.length || 0} mövzu`;
    document.getElementById('certdipCount').textContent = `${appData.certdip?.length || 0} mövzu`;
    document.getElementById('siraviPdfCount').textContent = `${appData.siravi?.length || 0} PDF`;
    document.getElementById('specialPdfCount').textContent = `${appData.special?.length || 0} PDF`;
    document.getElementById('certdipPdfCount').textContent = `${appData.certdip?.length || 0} PDF`;
}

// Navigation
function navigateTo(page, category) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (navLink) navLink.classList.add('active');
    
    currentPage = page;
    
    // Reset exam states
    document.getElementById('examCategorySelect').style.display = 'block';
    document.getElementById('examTopicSelect').style.display = 'none';
    document.getElementById('examActive').style.display = 'none';
    document.getElementById('examResult').style.display = 'none';
    document.getElementById('materialCategorySelect').style.display = 'block';
    document.getElementById('materialTopicList').style.display = 'none';
    
    if (category) {
        if (page === 'exam') selectExamCategory(category);
        if (page === 'material') selectMaterialCategory(category);
    }
    
    if (page === 'admin') updateAdminPanel();
    
    window.scrollTo(0, 0);
    closeMobileMenu();
}

function toggleMobileMenu() {
    document.getElementById('nav').classList.toggle('open');
}

function closeMobileMenu() {
    document.getElementById('nav').classList.remove('open');
}

// Search
function handleSearch(query) {
    const dropdown = document.getElementById('searchResults');
    if (!query || query.length < 2 || !appData) {
        dropdown.style.display = 'none';
        return;
    }
    
    const q = query.toLowerCase();
    let results = [];
    
    ['siravi', 'special', 'certdip'].forEach(cat => {
        (appData[cat] || []).forEach(topic => {
            if (topic.name.toLowerCase().includes(q)) {
                results.push({ type: 'topic', category: cat, topic: topic });
            }
            (topic.questions || []).forEach(question => {
                if (question.question && question.question.toLowerCase().includes(q)) {
                    results.push({ type: 'question', category: cat, topic: topic, question: question });
                }
            });
        });
    });
    
    if (results.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    
    const catNames = { siravi: 'Sıravi Heyət', special: 'Xüsusi Hazırlıq', certdip: 'Sertifikat/Diplom' };
    
    let html = '';
    results.slice(0, 15).forEach(r => {
        if (r.type === 'topic') {
            html += `<div class="search-result-item" onclick="navigateTo('exam', '${r.category}')">
                <div class="sr-title"><i class="fas fa-folder"></i> ${r.topic.name}</div>
                <div class="sr-meta">${catNames[r.category]} • ${r.topic.count} sual</div>
            </div>`;
        } else {
            const preview = r.question.question.substring(0, 80) + '...';
            html += `<div class="search-result-item" onclick="startExamWithTopic('${r.category}', ${appData[r.category].indexOf(r.topic)})">
                <div class="sr-title"><i class="fas fa-question-circle"></i> ${preview}</div>
                <div class="sr-meta">${catNames[r.category]} • ${r.topic.name}</div>
            </div>`;
        }
    });
    
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
}

// Close search on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box') && !e.target.closest('.search-results-dropdown')) {
        document.getElementById('searchResults').style.display = 'none';
    }
});

// Exam
function selectExamCategory(category) {
    currentExamCategory = category;
    document.getElementById('examCategorySelect').style.display = 'none';
    document.getElementById('examTopicSelect').style.display = 'block';
    
    const catNames = { siravi: 'Sıravi Heyət Hazırlığı', special: 'Xüsusi Hazırlıq', certdip: 'Sertifikat / Diplom' };
    document.getElementById('examCategoryName').textContent = catNames[category];
    document.getElementById('examCategoryTitle').textContent = catNames[category];
    
    const grid = document.getElementById('topicGrid');
    const topics = appData[category] || [];
    
    grid.innerHTML = topics.map((topic, idx) => `
        <div class="topic-card" onclick="startExamWithTopic('${category}', ${idx})">
            <div class="topic-icon"><i class="fas fa-file-alt"></i></div>
            <div class="topic-info">
                <h4>${topic.name}</h4>
                <p>${topic.count} sual</p>
            </div>
            <div class="topic-arrow"><i class="fas fa-chevron-right"></i></div>
        </div>
    `).join('');
}

function startExamWithTopic(category, topicIndex) {
    currentExamCategory = category;
    currentExamTopic = appData[category][topicIndex];
    
    document.getElementById('examCategorySelect').style.display = 'none';
    document.getElementById('examTopicSelect').style.display = 'none';
    document.getElementById('examActive').style.display = 'block';
    document.getElementById('examResult').style.display = 'none';
    document.getElementById('searchResults').style.display = 'none';
    
    const allQuestions = currentExamTopic.questions || [];
    if (allQuestions.length === 0) {
        alert('Bu mövzuda sual tapılmadı.');
        navigateTo('exam');
        return;
    }
    
    // Shuffle and pick 20
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    examQuestions = shuffled.slice(0, Math.min(20, shuffled.length));
    
    // Shuffle options for each question
    examQuestions = examQuestions.map(q => {
        if (q.options && q.options.length > 0) {
            const correctIdx = q.options.indexOf(q.correctAnswer);
            const shuffledOpts = [...q.options].sort(() => Math.random() - 0.5);
            return { ...q, shuffledOptions: shuffledOpts, correctShuffledIdx: shuffledOpts.indexOf(q.correctAnswer) };
        }
        // Generate options for simple format (no options provided)
        const correctAnswer = q.correctAnswer;
        const fakeOptions = generateFakeOptions(correctAnswer, allQuestions);
        const allOpts = [correctAnswer, ...fakeOptions].sort(() => Math.random() - 0.5);
        return { ...q, shuffledOptions: allOpts, correctShuffledIdx: allOpts.indexOf(correctAnswer) };
    });
    
    userAnswers = new Array(examQuestions.length).fill(-1);
    currentQuestionIndex = 0;
    
    // Start timer
    timerSeconds = 0;
    examStartTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    
    showQuestion();
}

function generateFakeOptions(correctAnswer, allQuestions) {
    const allAnswers = allQuestions.map(q => q.correctAnswer).filter(a => a && a !== correctAnswer);
    const uniqueAnswers = [...new Set(allAnswers)];
    const shuffled = uniqueAnswers.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(3, shuffled.length));
}

function showQuestion() {
    const q = examQuestions[currentQuestionIndex];
    const total = examQuestions.length;
    
    document.getElementById('questionNumber').textContent = `Sual ${currentQuestionIndex + 1}`;
    document.getElementById('questionText').textContent = q.question;
    document.getElementById('examProgress').style.width = `${((currentQuestionIndex + 1) / total) * 100}%`;
    document.getElementById('examProgressText').textContent = `${currentQuestionIndex + 1}/${total}`;
    
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const options = q.shuffledOptions || [];
    
    document.getElementById('optionsList').innerHTML = options.map((opt, idx) => `
        <div class="option-item ${userAnswers[currentQuestionIndex] === idx ? 'selected' : ''}" onclick="selectOption(${idx})">
            <div class="option-letter">${letters[idx]}</div>
            <div>${opt}</div>
        </div>
    `).join('');
    
    document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
    
    if (currentQuestionIndex === total - 1) {
        document.getElementById('nextBtn').style.display = 'none';
        document.getElementById('finishBtn').style.display = 'inline-flex';
    } else {
        document.getElementById('nextBtn').style.display = 'inline-flex';
        document.getElementById('finishBtn').style.display = 'none';
    }
}

function selectOption(idx) {
    userAnswers[currentQuestionIndex] = idx;
    document.querySelectorAll('.option-item').forEach((el, i) => {
        el.classList.toggle('selected', i === idx);
    });
}

function nextQuestion() {
    if (currentQuestionIndex < examQuestions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion();
    }
}

function updateTimer() {
    timerSeconds = Math.floor((Date.now() - examStartTime) / 1000);
    const min = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const sec = (timerSeconds % 60).toString().padStart(2, '0');
    document.getElementById('timerText').textContent = `${min}:${sec}`;
}

function finishExam() {
    const unanswered = userAnswers.filter(a => a === -1).length;
    if (unanswered > 0 && !confirm(`${unanswered} sual cavabsız qalıb. Bitirmək istəyirsiniz?`)) return;
    
    clearInterval(timerInterval);
    
    let correct = 0;
    const letters = ['A', 'B', 'C', 'D', 'E'];
    
    examQuestions.forEach((q, idx) => {
        const userAnswer = userAnswers[idx];
        const correctIdx = q.correctShuffledIdx;
        if (userAnswer === correctIdx) correct++;
    });
    
    const wrong = examQuestions.length - correct;
    const percent = Math.round((correct / examQuestions.length) * 100);
    const passed = correct >= 14;
    
    document.getElementById('examActive').style.display = 'none';
    document.getElementById('examResult').style.display = 'block';
    
    document.getElementById('resultIcon').innerHTML = passed ? '🏆' : '📚';
    document.getElementById('resultTitle').textContent = passed ? 'İmtahandan Keçdiniz!' : 'İmtahandan Kəsildiniz';
    document.getElementById('resultTitle').style.color = passed ? 'var(--success)' : 'var(--danger)';
    document.getElementById('resultTotal').textContent = examQuestions.length;
    document.getElementById('resultCorrect').textContent = correct;
    document.getElementById('resultWrong').textContent = wrong;
    document.getElementById('resultPercent').textContent = `${percent}%`;
    
    // Show detailed results
    let detailsHtml = '<h3 style="margin-bottom:1rem">Ətraflı Nəticə</h3>';
    examQuestions.forEach((q, idx) => {
        const userAnswer = userAnswers[idx];
        const correctIdx = q.correctShuffledIdx;
        const isCorrect = userAnswer === correctIdx;
        const userText = userAnswer >= 0 ? `${letters[userAnswer]}) ${q.shuffledOptions[userAnswer]}` : 'Cavab verilməyib';
        const correctText = `${letters[correctIdx]}) ${q.shuffledOptions[correctIdx]}`;
        
        detailsHtml += `
            <div class="result-detail-item ${isCorrect ? 'was-correct' : 'was-wrong'}">
                <div class="result-detail-question">${idx + 1}. ${q.question}</div>
                <div class="result-detail-answer">
                    ${isCorrect ? '✅' : '❌'} Sizin cavabınız: ${userText}
                    ${!isCorrect ? `<br>✅ Düzgün cavab: <strong>${correctText}</strong>` : ''}
                </div>
            </div>`;
    });
    
    document.getElementById('resultDetails').innerHTML = detailsHtml;
    window.scrollTo(0, 0);
}

function retryExam() {
    if (currentExamTopic) {
        const topicIdx = appData[currentExamCategory].indexOf(currentExamTopic);
        startExamWithTopic(currentExamCategory, topicIdx);
    }
}

// Material
function selectMaterialCategory(category) {
    currentExamCategory = category;
    document.getElementById('materialCategorySelect').style.display = 'none';
    document.getElementById('materialTopicList').style.display = 'block';
    
    const catNames = { siravi: 'Sıravi Heyət Hazırlığı', special: 'Xüsusi Hazırlıq', certdip: 'Sertifikat / Diplom' };
    document.getElementById('materialCategoryName').textContent = catNames[category];
    document.getElementById('materialCategoryTitle').textContent = catNames[category];
    
    const grid = document.getElementById('pdfGrid');
    const topics = appData[category] || [];
    
    grid.innerHTML = topics.map(topic => `
        <div class="pdf-card">
            <div class="pdf-icon"><i class="fas fa-file-pdf"></i></div>
            <div class="pdf-info">
                <h4>${topic.name}</h4>
                <p>${topic.count} sual</p>
            </div>
            <div class="pdf-actions">
                <a href="pdfs/${category}/${topic.filename}" target="_blank" class="pdf-btn" title="Bax">
                    <i class="fas fa-eye"></i>
                </a>
                <a href="pdfs/${category}/${topic.filename}" download class="pdf-btn" title="Yüklə">
                    <i class="fas fa-download"></i>
                </a>
            </div>
        </div>
    `).join('');
}

// Admin
function updateAdminPanel() {
    if (!appData) return;
    
    let totalQ = 0, totalT = 0;
    const catStats = {};
    
    ['siravi', 'special', 'certdip'].forEach(cat => {
        const topics = appData[cat] || [];
        let catQ = 0;
        topics.forEach(t => { catQ += t.count; totalT++; });
        totalQ += catQ;
        catStats[cat] = { topics: topics.length, questions: catQ };
    });
    
    document.getElementById('adminStats').innerHTML = `
        <div class="stat-row"><span>Ümumi sual</span><span class="stat-value">${totalQ.toLocaleString()}</span></div>
        <div class="stat-row"><span>Ümumi mövzu</span><span class="stat-value">${totalT}</span></div>
        <div class="stat-row"><span>Keçid balı</span><span class="stat-value">14/20</span></div>
        <div class="stat-row"><span>İmtahan müddəti</span><span class="stat-value">Limitsiz</span></div>
    `;
    
    document.getElementById('adminQuestionStats').innerHTML = `
        <div class="stat-row"><span>Sıravi heyət</span><span class="stat-value">${catStats.siravi.questions} sual (${catStats.siravi.topics} mövzu)</span></div>
        <div class="stat-row"><span>Xüsusi hazırlıq</span><span class="stat-value">${catStats.special.questions} sual (${catStats.special.topics} mövzu)</span></div>
        <div class="stat-row"><span>Sertifikat/Diplom</span><span class="stat-value">${catStats.certdip.questions} sual (${catStats.certdip.topics} mövzu)</span></div>
    `;
    
    const catNames = { siravi: 'Sıravi Heyət', special: 'Xüsusi Hazırlıq', certdip: 'Sertifikat/Diplom' };
    let pdfListHtml = '';
    ['siravi', 'special', 'certdip'].forEach(cat => {
        pdfListHtml += `<div style="margin-bottom:1rem">
            <div class="stat-row"><strong>${catNames[cat]}</strong><span class="stat-value">${appData[cat]?.length || 0} PDF</span></div>`;
        (appData[cat] || []).forEach(t => {
            pdfListHtml += `<div class="stat-row" style="padding-left:1rem;font-size:0.85rem">
                <span>${t.name}</span><span class="stat-value">${t.count}</span></div>`;
        });
        pdfListHtml += '</div>';
    });
    document.getElementById('adminPdfList').innerHTML = pdfListHtml;
}

// Init
loadData();
