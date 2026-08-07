let appData = null;
let currentPage = 'home';
let currentExamCategory = null;
let currentExamTopic = null;
let currentQuestionIndex = 0;
let examQuestions = [];
let userAnswers = [];
let confirmedAnswers = [];
let examMode = '20';
let examFinished = false;
let pendingCategory = null;
let pendingTopicIdx = null;
let timerInterval = null;
let timerSeconds = 0;
let examStartTime = null;
let examTimeLimit = 3600; // 60 minutes in seconds

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const CAT_NAMES = {
    siravi: 'Sıravi Heyət Hazırlığı',
    special: 'Xüsusi Hazırlıq',
    certdip: 'Sertifikat / Diplom'
};

async function loadData() {
    try {
        const response = await fetch('data/questions_data.json');
        appData = await response.json();
        updateStats();
        renderRoute();
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
    let hash;
    if (page === 'home') hash = '#home';
    else if (page === 'exam') hash = category ? `#exam/${category}` : '#exam';
    else if (page === 'material') hash = category ? `#material/${category}` : '#material';
    else return;

    if (location.hash === hash) {
        renderRoute();
    } else {
        location.hash = hash;
    }
}

function parseHash() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    const parts = h.split('/').filter(Boolean);

    if (parts.length === 0 || parts[0] === 'home') return { page: 'home' };

    if (parts[0] === 'exam') {
        if (parts.length === 1) return { page: 'exam', view: 'select' };
        if (parts[2] === 'quiz' || parts[2] === 'result') {
            return {
                page: 'exam',
                view: parts[2],
                category: parts[1],
                topicIdx: parseInt(parts[3], 10),
                mode: parts[4]
            };
        }
        return { page: 'exam', view: 'topics', category: parts[1] };
    }

    if (parts[0] === 'material') {
        if (parts.length === 1) return { page: 'material', view: 'select' };
        return { page: 'material', view: 'topics', category: parts[1] };
    }

    return { page: 'home' };
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function clearExamSession() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    examQuestions = [];
    userAnswers = [];
    confirmedAnswers = [];
    currentQuestionIndex = 0;
    examFinished = false;
    currentExamTopic = null;
    const feedback = document.getElementById('answerFeedback');
    if (feedback) feedback.style.display = 'none';
}

function renderRoute() {
    const route = parseHash();
    currentPage = route.page;
    closeModeModal();

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`page-${route.page}`);
    if (pageEl) pageEl.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navLink = document.querySelector(`.nav-link[data-page="${route.page}"]`);
    if (navLink) navLink.classList.add('active');

    document.getElementById('examCategorySelect').style.display = 'none';
    document.getElementById('examTopicSelect').style.display = 'none';
    document.getElementById('examActive').style.display = 'none';
    document.getElementById('examResult').style.display = 'none';
    document.getElementById('materialCategorySelect').style.display = 'none';
    document.getElementById('materialTopicList').style.display = 'none';

    if (route.page === 'home') {
        clearExamSession();
    } else if (route.page === 'exam') {
        if (route.view === 'select') {
            clearExamSession();
            document.getElementById('examCategorySelect').style.display = 'block';
        } else if (route.view === 'topics') {
            clearExamSession();
            renderExamTopics(route.category);
        } else if (route.view === 'quiz') {
            const live = currentExamCategory === route.category && examQuestions.length > 0 && !examFinished;
            if (live) {
                document.getElementById('examActive').style.display = 'block';
                showQuestion();
            } else {
                history.replaceState(null, '', `#exam/${route.category}`);
                renderExamTopics(route.category);
            }
        } else if (route.view === 'result') {
            const live = currentExamCategory === route.category && examFinished;
            if (live) {
                document.getElementById('examResult').style.display = 'block';
            } else {
                history.replaceState(null, '', `#exam/${route.category}`);
                renderExamTopics(route.category);
            }
        }
    } else if (route.page === 'material') {
        if (route.view === 'select') {
            clearExamSession();
            document.getElementById('materialCategorySelect').style.display = 'block';
        } else if (route.view === 'topics') {
            clearExamSession();
            renderMaterialTopics(route.category);
        }
    }

    window.scrollTo(0, 0);
    closeMobileMenu();
}

window.addEventListener('hashchange', renderRoute);

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

function renderExamTopics(category) {
    currentExamCategory = category;
    document.getElementById('examTopicSelect').style.display = 'block';
    document.getElementById('examCategoryName').textContent = CAT_NAMES[category];
    document.getElementById('examCategoryTitle').textContent = CAT_NAMES[category];

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
    pendingCategory = category;
    pendingTopicIdx = topicIdx;
    const topic = appData[category][topicIdx];
    const count = topic.questions?.length || 0;

    document.getElementById('modeModalTopicName').textContent = topic.name;
    document.getElementById('modeFullCount').textContent = `Bütün suallar (${count} sual)`;
    document.getElementById('modeModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModeModal() {
    document.getElementById('modeModal').style.display = 'none';
    document.body.style.overflow = '';
}

function startExam(mode) {
    closeModeModal();
    if (pendingCategory === null || pendingTopicIdx === null) return;

    currentExamCategory = pendingCategory;
    currentExamTopic = appData[pendingCategory][pendingTopicIdx];
    examMode = mode;
    examFinished = false;

    const questions = currentExamTopic.questions || [];
    const shuffled = shuffle(questions);
    examQuestions = examMode === '20' ? shuffled.slice(0, Math.min(20, shuffled.length)) : shuffled;

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
        const shuffledOptions = shuffle(allOptions);
        q.shuffledOptions = shuffledOptions;
        q.correctShuffledIdx = shuffledOptions.indexOf(correctAnswer);
    });

    currentQuestionIndex = 0;
    userAnswers = new Array(examQuestions.length).fill(-1);
    confirmedAnswers = new Array(examQuestions.length).fill(false);

    timerSeconds = 0;
    examTimeLimit = 3600; // 60 minutes
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    examStartTime = Date.now();

    const target = `#exam/${currentExamCategory}/quiz/${pendingTopicIdx}/${examMode}`;
    if (location.hash === target) {
        renderRoute();
    } else {
        location.hash = target;
    }
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
    const isFull = examMode === 'full';
    const confirmed = isFull && confirmedAnswers[currentQuestionIndex];

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

    const answer = userAnswers[currentQuestionIndex];
    const optionsList = document.getElementById('optionsList');
    optionsList.innerHTML = q.shuffledOptions.map((opt, idx) => {
        let cls = 'option-item';
        if (answer === idx) cls += ' selected';
        if (isFull && confirmed && idx === q.correctShuffledIdx) cls += ' correct';
        if (isFull && confirmed && answer === idx && idx !== q.correctShuffledIdx) cls += ' wrong';
        if (isFull && confirmed) cls += ' disabled';
        return `<div class="${cls}" onclick="selectOption(${idx})">
            <div class="option-letter">${LETTERS[idx]}</div>
            <div class="option-text">${opt}</div>
        </div>`;
    }).join('');

    const feedback = document.getElementById('answerFeedback');
    if (isFull && confirmed) {
        const ok = answer === q.correctShuffledIdx;
        feedback.className = 'answer-feedback ' + (ok ? 'correct' : 'wrong');
        feedback.innerHTML = ok
            ? '<i class="fas fa-check-circle"></i><span>Doğru!</span>'
            : `<i class="fas fa-times-circle"></i><span>Yanlış! Düzgün cavab: <strong>${LETTERS[q.correctShuffledIdx]}) ${q.shuffledOptions[q.correctShuffledIdx]}</strong></span>`;
        feedback.style.display = 'flex';
    } else {
        feedback.style.display = 'none';
    }

    const prevBtn = document.getElementById('prevBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');

    prevBtn.disabled = currentQuestionIndex === 0;

    const isLast = currentQuestionIndex === total - 1;

    if (isFull) {
        confirmBtn.style.display = confirmed ? 'none' : 'inline-flex';
        confirmBtn.disabled = answer === -1;
        nextBtn.style.display = isLast ? 'none' : 'inline-flex';
        nextBtn.disabled = !confirmed;
        finishBtn.style.display = isLast ? 'inline-flex' : 'none';
        finishBtn.disabled = !confirmed;
    } else {
        confirmBtn.style.display = 'none';
        nextBtn.style.display = isLast ? 'none' : 'inline-flex';
        nextBtn.disabled = false;
        finishBtn.style.display = isLast ? 'inline-flex' : 'none';
        finishBtn.disabled = false;
    }
}

function selectOption(idx) {
    if (examMode === 'full') {
        if (confirmedAnswers[currentQuestionIndex]) return;
        userAnswers[currentQuestionIndex] = idx;
        showQuestion();
        return;
    }

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

function confirmAnswer() {
    if (examMode !== 'full') return;
    if (userAnswers[currentQuestionIndex] === -1 || confirmedAnswers[currentQuestionIndex]) return;
    confirmedAnswers[currentQuestionIndex] = true;
    showQuestion();
}

function nextQuestion() {
    if (examMode === 'full' && !confirmedAnswers[currentQuestionIndex]) return;
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

    examFinished = true;
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
    const passed = percent >= 70; // 14/20 = 70%

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
    const topicIdx = currentExamTopic ? appData[currentExamCategory].indexOf(currentExamTopic) : 0;
    history.replaceState(null, '', `#exam/${currentExamCategory}/result/${topicIdx}/${examMode}`);
    window.scrollTo(0, 0);
}

function retryExam() {
    if (!currentExamTopic || !currentExamCategory) return;
    pendingCategory = currentExamCategory;
    pendingTopicIdx = appData[currentExamCategory].indexOf(currentExamTopic);
    startExam(examMode);
}

function renderMaterialTopics(category) {
    currentExamCategory = category;
    document.getElementById('materialTopicList').style.display = 'block';

    document.getElementById('materialCategoryName').textContent = CAT_NAMES[category];
    document.getElementById('materialCategoryTitle').textContent = CAT_NAMES[category];

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
    if (e.key === 'Escape') {
        closeImageModal();
        closeModeModal();
    }
});

loadData();
