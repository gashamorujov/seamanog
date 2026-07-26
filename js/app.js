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
let examTimeLimit = 3600; // 60 minutes in seconds

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

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
    
    ['siravi', 'special', 'certdip'].forEach(cat => {
        const count = appData[cat]?.length || 0;
        const el = document.getElementById(cat + 'Count');
        if (el) el.textContent = `${count} mövzu`;
    });
    
    document.getElementById('siraviPdfCount').textContent = `${appData.siravi?.length || 0} PDF`;
    document.getElementById('specialPdfCount').textContent = `${appData.special?.length || 0} PDF`;
    document.getElementById('certdipPdfCount').textContent = `${appData.certdip?.length || 0} PDF`;
}

function navigateTo(page, category) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');
    
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (navLink) navLink.classList.add('active');
    
    currentPage = page;
    
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
    
    window.scrollTo(0, 0);
    closeMobileMenu();
}

function toggleMobileMenu() {
    document.getElementById('nav').classList.toggle('open');
}

function closeMobileMenu() {
    document.getElementById('nav').classList.remove('open');
}

function handleSearch(query) {
    const dropdown = document.getElementById('searchResults');
    if (!query || query.length < 2 || !appData) {
        dropdown.style.display = 'none';
        return;
    }
    
    const q = query.toLowerCase();
    let results = [];
    const catNames = { siravi: 'Sıravi Heyət', special: 'Xüsusi Hazırlıq', certdip: 'Sertifikat/Diplom' };
    
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
    
    let html = '';
    results.slice(0, 15).forEach(r => {
        if (r.type === 'topic') {
            html += `<div class="search-result-item" onclick="navigateTo('exam', '${r.category}')">
                <div class="sr-title"><i class="fas fa-folder"></i> ${r.topic.name}</div>
                <div class="sr-meta">${catNames[r.category]} • ${r.topic.questions?.length || 0} sual</div>
            </div>`;
        } else {
            const preview = r.question.question.substring(0, 80) + '...';
            const topicIdx = appData[r.category].indexOf(r.topic);
            html += `<div class="search-result-item" onclick="startExamWithTopic('${r.category}', ${topicIdx})">
                <div class="sr-title"><i class="fas fa-question-circle"></i> ${preview}</div>
                <div class="sr-meta">${catNames[r.category]} • ${r.topic.name}</div>
            </div>`;
        }
    });
    
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
}

document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('searchResults');
    const searchBox = document.getElementById('searchBox');
    if (dropdown && !dropdown.contains(e.target) && searchBox && !searchBox.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

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
            <div class="topic-card-icon"><i class="fas fa-file-alt"></i></div>
            <div style="flex:1;min-width:0">
                <h4>${topic.name}</h4>
                <span class="topic-count">${topic.questions?.length || 0} sual</span>
            </div>
        </div>
    `).join('');
}

function startExamWithTopic(category, topicIdx) {
    currentExamCategory = category;
    currentExamTopic = appData[category][topicIdx];
    
    document.getElementById('examCategorySelect').style.display = 'none';
    document.getElementById('examTopicSelect').style.display = 'none';
    document.getElementById('examActive').style.display = 'block';
    document.getElementById('examResult').style.display = 'none';
    
    const questions = currentExamTopic.questions || [];
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    examQuestions = shuffled.slice(0, Math.min(20, shuffled.length));
    
    // Create shuffled options with correct answer
    examQuestions.forEach(q => {
        const correctAnswer = q.correctAnswer;
        const existingOptions = q.options || [];
        
        let allOptions = [correctAnswer];
        existingOptions.forEach(opt => {
            if (opt !== correctAnswer && !allOptions.includes(opt)) {
                allOptions.push(opt);
            }
        });
        
        while (allOptions.length < 5) {
            const randomQ = questions[Math.floor(Math.random() * questions.length)];
            if (randomQ.correctAnswer && !allOptions.includes(randomQ.correctAnswer)) {
                allOptions.push(randomQ.correctAnswer);
            }
            if (allOptions.length < 5) {
                const fallbacks = ['Bütün cavablar düzgündür', 'Bütün cavablar yanlışdır', 'Heç biri düzgün deyil'];
                for (const fb of fallbacks) {
                    if (!allOptions.includes(fb)) {
                        allOptions.push(fb);
                        break;
                    }
                }
            }
        }
        
        allOptions = allOptions.slice(0, 5);
        const shuffledOptions = [...allOptions].sort(() => Math.random() - 0.5);
        q.shuffledOptions = shuffledOptions;
        q.correctShuffledIdx = shuffledOptions.indexOf(correctAnswer);
    });
    
    currentQuestionIndex = 0;
    userAnswers = new Array(examQuestions.length).fill(-1);
    
    timerSeconds = 0;
    examTimeLimit = 3600; // 60 minutes
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    examStartTime = Date.now();
    
    showQuestion();
}

function updateTimer() {
    timerSeconds++;
    const remaining = examTimeLimit - timerSeconds;
    
    if (remaining <= 0) {
        clearInterval(timerInterval);
        finishExam();
        return;
    }
    
    const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
    const secs = (remaining % 60).toString().padStart(2, '0');
    const timerEl = document.getElementById('timerDisplay');
    timerEl.textContent = `${mins}:${secs}`;
    
    // Warning when less than 5 minutes
    const timerContainer = document.getElementById('examTimer');
    if (remaining <= 300) {
        timerContainer.classList.add('timer-warning');
    } else {
        timerContainer.classList.remove('timer-warning');
    }
}

function showQuestion() {
    const q = examQuestions[currentQuestionIndex];
    const total = examQuestions.length;
    
    document.getElementById('questionNumber').textContent = `Sual ${currentQuestionIndex + 1}`;
    document.getElementById('questionText').textContent = q.question;
    document.getElementById('questionCounter').textContent = `${currentQuestionIndex + 1} / ${total}`;
    document.getElementById('examProgressFill').style.width = `${((currentQuestionIndex + 1) / total) * 100}%`;
    
    const imgContainer = document.getElementById('questionImageContainer');
    if (q.hasImage && q.images && q.images.length > 0) {
        imgContainer.style.display = 'block';
        document.getElementById('questionImage').src = q.images[0];
    } else {
        imgContainer.style.display = 'none';
    }
    
    const optionsList = document.getElementById('optionsList');
    optionsList.innerHTML = q.shuffledOptions.map((opt, idx) => `
        <div class="option-item ${userAnswers[currentQuestionIndex] === idx ? 'selected' : ''}" onclick="selectOption(${idx})">
            <div class="option-letter">${LETTERS[idx]}</div>
            <div class="option-text">${opt}</div>
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
    document.querySelectorAll('.option-item').forEach((item, i) => {
        item.classList.toggle('selected', i === idx);
    });
    setTimeout(() => {
        if (currentQuestionIndex < examQuestions.length - 1) {
            nextQuestion();
        }
    }, 300);
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

function finishExam() {
    if (timerInterval) clearInterval(timerInterval);
    
    document.getElementById('examActive').style.display = 'none';
    document.getElementById('examResult').style.display = 'block';
    
    let correct = 0, wrong = 0, skipped = 0;
    
    examQuestions.forEach((q, idx) => {
        if (userAnswers[idx] === -1) {
            skipped++;
        } else if (userAnswers[idx] === q.correctShuffledIdx) {
            correct++;
        } else {
            wrong++;
        }
    });
    
    const total = examQuestions.length;
    const percent = Math.round((correct / total) * 100);
    const passed = correct >= 14; // 14/20 pass
    
    document.getElementById('resultIcon').textContent = passed ? '🎉' : '😔';
    document.getElementById('resultTitle').textContent = passed ? 'Təbriklər! İmtahanı keçdiniz!' : 'İmtahanı keçə bilmədiniz';
    document.getElementById('resultCorrect').textContent = correct;
    document.getElementById('resultWrong').textContent = wrong;
    document.getElementById('resultSkipped').textContent = skipped;
    document.getElementById('resultPercent').textContent = `${percent}%`;
    
    let detailsHtml = '<h3 style="margin-bottom:1rem">Ətraflı Nəticə</h3>';
    examQuestions.forEach((q, idx) => {
        const userAnswer = userAnswers[idx];
        const correctIdx = q.correctShuffledIdx;
        const isCorrect = userAnswer === correctIdx;
        const userText = userAnswer >= 0 ? `${LETTERS[userAnswer]}) ${q.shuffledOptions[userAnswer]}` : 'Cavab verilməyib';
        const correctText = `${LETTERS[correctIdx]}) ${q.shuffledOptions[correctIdx]}`;
        
        let imgHtml = '';
        if (q.hasImage && q.images && q.images.length > 0) {
            imgHtml = `<div style="margin-top:0.5rem"><img src="${q.images[0]}" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--border)" alt="Sual şəkli"></div>`;
        }
        
        detailsHtml += `
            <div class="result-detail-item ${isCorrect ? 'was-correct' : 'was-wrong'}">
                <div class="result-detail-question">${idx + 1}. ${q.question}</div>
                ${imgHtml}
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
                <p>${topic.questions?.length || 0} sual</p>
            </div>
            <div class="pdf-actions">
                <a href="pdfs/${category}/${encodeURIComponent(topic.filename)}" target="_blank" class="pdf-btn" title="Bax">
                    <i class="fas fa-eye"></i>
                </a>
                <a href="pdfs/${category}/${encodeURIComponent(topic.filename)}" download class="pdf-btn" title="Yüklə">
                    <i class="fas fa-download"></i>
                </a>
            </div>
        </div>
    `).join('');
}

function openImageModal(src) {
    const modal = document.getElementById('imageModal');
    document.getElementById('modalImage').src = src;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeImageModal();
});

loadData();
