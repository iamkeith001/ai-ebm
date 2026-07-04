// EBM Assistant Core Logic
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initPicoBuilder();
    initAppraisalTool();
    initGradeSynthesizer();
    initReportGenerator();
});

// 1. Navigation & Tab Control
window.switchTab = (targetTab) => {
    const menuItems = document.querySelectorAll('.sidebar-item');
    const tabContents = document.querySelectorAll('.tab-content');

    // Toggle active sidebar menu
    menuItems.forEach(mi => {
        if (mi.getAttribute('data-tab') === targetTab) {
            mi.classList.add('active');
        } else {
            mi.classList.remove('active');
        }
    });
    
    // Toggle active content tab
    tabContents.forEach(tc => {
        tc.classList.remove('active');
        if (tc.id === targetTab) {
            tc.classList.add('active');
        }
    });

    // If switching to report tab, compile latest EBM data
    if (targetTab === 'report') {
        compileEbmReport();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function initNavigation() {
    const menuItems = document.querySelectorAll('.sidebar-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
}

// Local Database of EBM Presets for AI extraction demonstration
const CLINICAL_PRESETS = {
    taichi: {
        scenario: "探討太極拳是否能有效改善慢性阻塞性肺疾病(COPD)患者的運動能力與健康相關的生活品質。",
        p: "慢性阻塞性肺疾病患者 (COPD Patients)",
        p_mesh: '"Pulmonary Disease, Chronic Obstructive"[Mesh] OR "COPD" OR "Chronic Obstructive Pulmonary Disease"',
        i: "太極運動療法 (Tai Chi Exercises)",
        i_mesh: '"Tai Ji"[Mesh] OR "Tai Chi" OR "Taiji"',
        c: "常規照護或無運動組 (Usual Care / Control Group)",
        c_mesh: '"Standard Care" OR "Usual Care" OR "Control Group"',
        o: "運動能力、健康相關生活品質 (Exercise Capacity, Quality of Life)",
        o_mesh: '"Exercise Tolerance"[Mesh] OR "Exercise Capacity" OR "Quality of Life"[Mesh] OR "QoL"',
        synonyms: {
            p: ["COAD", "Pulmonary Emphysema", "Chronic Obstructive Airway Disease"],
            i: ["Tai Ji Chuan", "Mind-Body Exercise", "Qigong"],
            c: ["Standard Care", "Placebo Group", "No Exercise"],
            o: ["6-Minute Walk Test", "6MWD", "SGRQ Score", "Health Status"]
        }
    },
    toothbrush: {
        scenario: "比較使用電動牙刷加上沖牙機，相較於單純使用電動牙刷，對於改善成年人牙菌斑及牙齦炎之臨床成效。",
        p: "成年牙菌斑或牙齦炎患者 (Adults with Plaque or Gingivitis)",
        p_mesh: '"Adult"[Mesh] AND ("Dental Plaque"[Mesh] OR "Gingivitis"[Mesh])',
        i: "電動牙刷合併沖牙機 (Electric Toothbrush and Oral Irrigator)",
        i_mesh: '"Toothbrush, Electric"[Mesh] AND "Oral Irrigators"[Mesh] OR "Water Flosser"',
        c: "單純使用電動牙刷 (Electric Toothbrush alone)",
        c_mesh: '"Toothbrush, Electric"[Mesh]',
        o: "牙菌斑指數、牙齦發炎指數改善 (Plaque Index, Gingival Index)",
        o_mesh: '"Dental Plaque Index"[Mesh] OR "Gingival Index" OR "Plaque reduction"',
        synonyms: {
            p: ["Dental Plaque", "Gingival Diseases", "Gingivitis"],
            i: ["Water Flosser", "Oral Irrigation Device", "Dental Irrigator"],
            c: ["Manual Toothbrush", "Toothbrushing"],
            o: ["Plaque Index", "Gingival Bleeding", "Sulcus Bleeding Index"]
        }
    },
    peg: {
        scenario: "評估大腸鏡檢查前，服用聚乙二醇溶液 (PEG) 1公升配水與服用 2公升溶液，在腸道準備清潔度上的成效比對。",
        p: "接受大腸鏡檢查之患者 (Patients undergoing Colonoscopy)",
        p_mesh: '"Colonoscopy"[Mesh] OR "Colonies"',
        i: "低劑量 1公升 聚乙二醇溶液 (Low-volume 1L PEG)",
        i_mesh: '"Polyethylene Glycols"[Mesh] AND "1L" OR "1 Liter"',
        c: "標準劑量 2公升 聚乙二醇溶液 (Standard-volume 2L PEG)",
        c_mesh: '"Polyethylene Glycols"[Mesh] AND "2L" OR "2 Liters"',
        o: "腸道準備清潔度、受檢者耐受度 (Bowel Cleansing, Patient Tolerability)",
        o_mesh: '"Cathartics"[Mesh] OR "Bowel Preparation" OR "BBPS" OR "Boston Bowel Preparation Scale"',
        synonyms: {
            p: ["Colorectal Cancer Screening", "Sigmoidoscopy"],
            i: ["Low-volume PEG", "Polyethylene Glycol 3350"],
            c: ["Standard PEG", "Split-dose PEG", "PEG-ELS"],
            o: ["Boston Bowel Prep Scale", "BBPS Score", "Aronchick Scale"]
        }
    }
};

// 2. PICO Builder Logic
let currentPicoData = {
    p: '', p_mesh: '',
    i: '', i_mesh: '',
    c: '', c_mesh: '',
    o: '', o_mesh: ''
};

function initPicoBuilder() {
    const scenarioInput = document.getElementById('clinical-scenario');
    const extractBtn = document.getElementById('btn-extract-pico');
    const aiNotify = document.getElementById('ai-extraction-notice');
    const meshSuggest = document.getElementById('mesh-suggestions');
    
    // Auto preset filler
    window.fillPreset = (presetKey) => {
        const data = CLINICAL_PRESETS[presetKey];
        if (!data) return;
        
        scenarioInput.value = data.scenario;
        
        // Trigger simulated AI extraction
        aiNotify.style.display = 'flex';
        meshSuggest.style.display = 'block';
        
        document.getElementById('pico-p').value = data.p;
        document.getElementById('pico-p-mesh').value = data.p_mesh;
        document.getElementById('pico-i').value = data.i;
        document.getElementById('pico-i-mesh').value = data.i_mesh;
        document.getElementById('pico-c').value = data.c;
        document.getElementById('pico-c-mesh').value = data.c_mesh;
        document.getElementById('pico-o').value = data.o;
        document.getElementById('pico-o-mesh').value = data.o_mesh;
        
        updateSearchQuery();

        // Render AI Synonym suggestions
        const synCard = document.getElementById('pico-synonyms-card');
        const synContainer = document.getElementById('synonyms-container');
        if (synCard && synContainer && data.synonyms) {
            synCard.style.display = 'block';
            synContainer.innerHTML = '';
            
            const categories = {
                p: { label: '患者 (P) 建議詞', bg: 'p-bg' },
                i: { label: '介入 (I) 建議詞', bg: 'i-bg' },
                c: { label: '對照 (C) 建議詞', bg: 'c-bg' },
                o: { label: '結局 (O) 建議詞', bg: 'o-bg' }
            };

            Object.keys(categories).forEach(catKey => {
                const list = data.synonyms[catKey];
                if (list && list.length > 0) {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.gap = '12px';
                    
                    const badge = document.createElement('span');
                    badge.className = `pico-badge ${categories[catKey].bg}`;
                    badge.style.minWidth = '110px';
                    badge.style.textAlign = 'center';
                    badge.textContent = categories[catKey].label;
                    
                    const tagGroup = document.createElement('div');
                    tagGroup.style.display = 'flex';
                    tagGroup.style.gap = '8px';
                    tagGroup.style.flexWrap = 'wrap';
                    
                    list.forEach(syn => {
                        const btn = document.createElement('button');
                        btn.className = 'btn btn-secondary';
                        btn.style.padding = '4px 10px';
                        btn.style.fontSize = '12px';
                        btn.innerHTML = `<i class="fa-solid fa-plus" style="margin-right:4px;"></i> ${syn}`;
                        btn.addEventListener('click', () => {
                            addSynonym(catKey, syn);
                        });
                        tagGroup.appendChild(btn);
                    });
                    
                    row.appendChild(badge);
                    row.appendChild(tagGroup);
                    synContainer.appendChild(row);
                }
            });
        }
    };

    window.addSynonym = (catKey, term) => {
        const inputId = `pico-${catKey}-mesh`;
        const inputEl = document.getElementById(inputId);
        if (inputEl) {
            let currentVal = inputEl.value.trim();
            if (currentVal) {
                if (!currentVal.includes(`"${term}"`)) {
                    inputEl.value = `${currentVal} OR "${term}"`;
                }
            } else {
                inputEl.value = `"${term}"`;
            }
            updateSearchQuery();
        }
    };

    extractBtn.addEventListener('click', () => {
        const text = scenarioInput.value.trim();
        if (!text) {
            alert('請輸入臨床情境描述！');
            return;
        }

        // Search if we match any preset keywords
        let matchedPreset = null;
        if (text.includes('太極') || text.includes('COPD')) {
            matchedPreset = 'taichi';
        } else if (text.includes('牙刷') || text.includes('牙齦')) {
            matchedPreset = 'toothbrush';
        } else if (text.includes('聚乙二醇') || text.includes('PEG') || text.includes('大腸鏡')) {
            matchedPreset = 'peg';
        }

        if (matchedPreset) {
            fillPreset(matchedPreset);
        } else {
            // General heuristics for other scenarios
            aiNotify.style.display = 'flex';
            meshSuggest.style.display = 'block';
            
            // Basic parser splits by space/punctuation and populates fields
            const terms = text.split(/[,，。；;、\s]+/);
            
            document.getElementById('pico-p').value = terms[0] || '特異性病患群體';
            document.getElementById('pico-p-mesh').value = `"${terms[0] || 'Patient Group'}"[Mesh]`;
            
            document.getElementById('pico-i').value = terms[1] || '主要干預措施';
            document.getElementById('pico-i-mesh').value = `"${terms[1] || 'Intervention'}"[Mesh]`;
            
            document.getElementById('pico-c').value = terms[2] || '對照常規組';
            document.getElementById('pico-c-mesh').value = `"${terms[2] || 'Control'}"[Mesh]`;
            
            document.getElementById('pico-o').value = terms[3] || '期望之臨床結局';
            document.getElementById('pico-o-mesh').value = `"${terms[3] || 'Outcome'}"[Mesh]`;
            
            updateSearchQuery();
        }
    });

    // Handle manual inputs and keyups
    const inputs = ['pico-p', 'pico-p-mesh', 'pico-i', 'pico-i-mesh', 'pico-c', 'pico-c-mesh', 'pico-o', 'pico-o-mesh'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updateSearchQuery);
    });
}

function updateSearchQuery() {
    currentPicoData.p = document.getElementById('pico-p').value.trim();
    currentPicoData.p_mesh = document.getElementById('pico-p-mesh').value.trim();
    currentPicoData.i = document.getElementById('pico-i').value.trim();
    currentPicoData.i_mesh = document.getElementById('pico-i-mesh').value.trim();
    currentPicoData.c = document.getElementById('pico-c').value.trim();
    currentPicoData.c_mesh = document.getElementById('pico-c-mesh').value.trim();
    currentPicoData.o = document.getElementById('pico-o').value.trim();
    currentPicoData.o_mesh = document.getElementById('pico-o-mesh').value.trim();

    // Assemble Boolean PubMed Query
    let queryParts = [];
    if (currentPicoData.p_mesh) queryParts.push(`(${currentPicoData.p_mesh})`);
    if (currentPicoData.i_mesh) queryParts.push(`(${currentPicoData.i_mesh})`);
    if (currentPicoData.c_mesh) queryParts.push(`(${currentPicoData.c_mesh})`);
    if (currentPicoData.o_mesh) queryParts.push(`(${currentPicoData.o_mesh})`);

    const fullQuery = queryParts.join(' AND ');
    document.getElementById('pubmed-query-string').textContent = fullQuery || '((患者/疾病主題詞) AND (介入措施主題詞) AND (對照/比較主題詞) AND (臨床結局主題詞))';
}

window.copyQueryToClipboard = () => {
    const queryText = document.getElementById('pubmed-query-string').textContent;
    if (queryText.includes('((患者/疾病主題詞)')) {
        alert('請先輸入或萃取 PICO 資料以生成檢索字串！');
        return;
    }
    navigator.clipboard.writeText(queryText).then(() => {
        alert('PubMed 臨床檢索字串已複製至剪貼簿！');
    });
};


// 3. Critical Appraisal Tool Logic
const CHECKLIST_QUESTIONS = {
    rct: [
        { id: 'q1', section: 'A：試驗結果的效度 (Validity)', text: '該試驗是否針對一個明確界定的臨床問題？', help: '研究群體、干預方法、對照方法、臨床結局是否清晰？' },
        { id: 'q2', section: 'A：試驗結果的效度 (Validity)', text: '受試者的隨機分配方式是否適當？', help: '序列產生方式是否隨機？是否隱藏隨機分配序列 (Allocation concealment)？' },
        { id: 'q3', section: 'A：試驗結果的效度 (Validity)', text: '所有進入試驗的病患是否都已適當計入結論？', help: '是否完成追蹤？是否使用意向分析法 (Intention-to-treat, ITT)？' },
        { id: 'q4', section: 'A：試驗結果的效度 (Validity)', text: '病患、臨床醫師和試驗人員是否對分配結果保持盲檢 (Blinded)？', help: '雙盲或單盲？如果沒有，是否會引入測量偏倚？' },
        { id: 'q5', section: 'A：試驗結果的效度 (Validity)', text: '各組別在試驗開始時是否具有相似的基準特徵？', help: '年齡、性別、疾病嚴重程度等基線資料是否平衡？' },
        { id: 'q6', section: 'A：試驗結果的效度 (Validity)', text: '除了實驗性干預外，各組別是否得到平等的對待？', help: '有無其他額外治療偏倚？隨訪頻率是否相同？' },
        { id: 'q7', section: 'B：試驗結果是什麼 (Results)', text: '治療效果有多大？', help: '相對危險度減低率 (RRR)、絕對危險度減低率 (ARR)、需治數 (NNT) 或均值差是多少？' },
        { id: 'q8', section: 'B：試驗結果是什麼 (Results)', text: '治療評估的精確度如何？', help: '信賴區間 (95% CI) 是寬還是窄？是否具有臨床顯著意義？' },
        { id: 'q9', section: 'C：結果對本地的適用性 (Applicability)', text: '這些結果是否能應用於我本地的病患？', help: '你的病患與試驗中的病患是否有重大差異？' },
        { id: 'q10', section: 'C：結果對本地的適用性 (Applicability)', text: '是否考慮了所有具有臨床重要性的結局指標？', help: '療效、副作用、患者滿意度、成本效益等是否都納入？' },
        { id: 'q11', section: 'C：結果對本地的適用性 (Applicability)', text: '治療的效益是否大於潛在的危害與成本？', help: '需治數 (NNT) 與需害數 (NNH) 之間的權衡。' }
    ],
    sr: [
        { id: 'q1', section: 'A：系統回顧結果的效度 (Validity)', text: '該回顧是否針對一個明確界定的問題？', help: 'PICO 問題是否明確清晰？' },
        { id: 'q2', section: 'A：系統回顧結果的效度 (Validity)', text: '作者是否檢索了合適且足夠的文獻庫？', help: '檢索策略是否完整？是否有包含灰色文獻或跨資料庫？' },
        { id: 'q3', section: 'A：系統回顧結果的效度 (Validity)', text: '作者是否評估了納入研究的品質？', help: '有無使用如 Cochrane 偏倚風險工具評估單個研究？' },
        { id: 'q4', section: 'A：系統回顧結果的效度 (Validity)', text: '如果各項研究的結果被合併，這種合併是否合理？', help: '異質性 (Heterogeneity) 是否過高？是否使用適當的效應模型？' },
        { id: 'q5', section: 'B：系統回顧的結果是什麼 (Results)', text: '回顧的總體結果是什麼？', help: '合併後的勝算比 (OR)、相對危險度 (RR) 或均值差是多少？' },
        { id: 'q6', section: 'B：系統回顧的結果是什麼 (Results)', text: '結果的精確度如何？', help: '森林圖 (Forest plot) 的 95% 信賴區間寬窄如何？' },
        { id: 'q7', section: 'C：結果在本地的適用性 (Applicability)', text: '結果是否能應用於我本地的病患？', help: '本地患者基線特徵是否與合併研究一致？' },
        { id: 'q8', section: 'C：結果在本地的適用性 (Applicability)', text: '是否考慮了所有重要的結局指標？', help: '有無漏掉安全性或長期生活品質的指標？' },
        { id: 'q9', section: 'C：結果在本地的適用性 (Applicability)', text: '是否考慮了結果中的利益、危害及成本？', help: '合併療效與風險的對比。' }
    ],
    diag: [
        { id: 'q1', section: 'A：診斷研究結果的效度 (Validity)', text: '該診斷試驗是否與黃金標準 (Gold Standard) 進行了盲法比較？', help: '受試者是否同時接受了黃金標準和待測診斷？兩者是否互相盲檢？' },
        { id: 'q2', section: 'A：診斷研究結果的效度 (Validity)', text: '研究群體是否包含臨床上懷疑患有該病的典型患者？', help: '光譜偏倚 (Spectrum Bias) 防範：是否包含了輕度、中度、重度及類似疾病患者？' },
        { id: 'q3', section: 'A：診斷研究結果的效度 (Validity)', text: '參考標準的診斷是否不受待測診斷的影響？', help: '驗證偏倚 (Verification Bias) 防範：是否每個人不論診斷測試結果如何，都接受了黃金標準？' },
        { id: 'q4', section: 'B：診斷研究結果是什麼 (Results)', text: '是否給出了敏感度、特異度及概似比 (Likelihood Ratios, LR)？', help: '是否有陽性與陰性預測值、陽性概似比 (LR+) 和陰性概似比 (LR-)？' },
        { id: 'q5', section: 'B：診斷研究結果是什麼 (Results)', text: '診斷精確度指標的信賴區間如何？', help: '95% CI 是否足夠精確？' },
        { id: 'q6', section: 'C：結果在本地的適用性 (Applicability)', text: '該診斷試驗在我的醫療機構中是否可行？', help: '設備、技術、專業人員素質是否允許？成本是否合理？' },
        { id: 'q7', section: 'C：結果在本地的適用性 (Applicability)', text: '診斷的測試結果是否能改變我的臨床決策？', help: '測試結果是否會直接影響後續的治療或處置計畫？' },
        { id: 'q8', section: 'C：結果在本地的適用性 (Applicability)', text: '我的病患是否能從這項診斷測試中真正獲益？', help: '診斷的準確性能否轉化為更好的臨床結局？' }
    ]
};

let activeChecklistType = 'rct';
let checklistAnswers = {};

function initAppraisalTool() {
    renderChecklist('rct');

    // Handle checklist type selection
    const cards = document.querySelectorAll('.checklist-type-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            const type = card.getAttribute('data-type');
            activeChecklistType = type;
            renderChecklist(type);
        });
    });

    // Hook up AI Auto-Appraisal button
    const aiAppraiseBtn = document.getElementById('btn-ai-appraise');
    if (aiAppraiseBtn) {
        aiAppraiseBtn.addEventListener('click', () => {
            const abstractText = document.getElementById('abstract-text').value.trim();
            if (!abstractText) {
                alert('請先貼上文獻摘要內容！');
                return;
            }

            // Force active tab to RCT (since our mock DB handles RCT for COPD)
            activeChecklistType = 'rct';
            const rctCard = document.querySelector('.checklist-type-card[data-type="rct"]');
            if (rctCard) {
                cards.forEach(c => c.classList.remove('active'));
                rctCard.classList.add('active');
            }
            renderChecklist('rct');

            // Populate the mock answers
            const mockAppraisals = {
                q1: { val: 'yes', reason: '本隨機對照試驗 (RCT) 明確界定了研究對象為 COPD 患者，介入措施為太極拳，對照組為常規醫療照護，主要臨床結局為患者運動耐受力與生活品質，與檢索提問完全一致。' },
                q2: { val: 'yes', reason: '文內明確提及使用「電腦隨機數字生成器 (computer-generated random numbers)」進行患者隨機分組，且由獨立研究助理持封閉信封遮蔽，具備適當隨機分配與分配隱匿 (Allocation Concealment)。' },
                q3: { val: 'yes', reason: '所有隨機入組的 120 名病患（太極組 60 人，對照組 60 人）皆完成了全程 12 週的隨訪，失訪率為 0%，並採用意向分析法 (ITT) 進行統計分析，排除耗損偏倚。' },
                q4: { val: 'cant', reason: '由於太極拳為實體運動干預，病患與指導教練無法實施盲檢 (Blinding)；但文中提及測量臨床結局指標（如 6 鐘步行試驗）的評估者保持盲檢，屬部分盲檢。' },
                q5: { val: 'yes', reason: '在表一 (Table 1) 中，兩組病患的平均年齡、FEV1 肺功能基線值、吸菸史與性別比率在統計學上均無顯著差異，基線特徵高度一致。' },
                q6: { val: 'yes', reason: '除太極拳組接受每週三次運動訓練外，兩組患者皆繼續接受完全相同的支氣管擴張劑處方，且隨訪頻率相同，無額外治療偏倚。' },
                q7: { val: 'yes', reason: '介入 12 週後，太極拳組的 6 分鐘步行距離 (6MWD) 較對照組顯著改善，平均差值為 32.5 米 (p < 0.01)，具備中到高程度的治療效益。' },
                q8: { val: 'yes', reason: '步行距離之平均差值信賴區間為 [15.2, 49.8] 米，區間下限仍大於臨床最小重要差異值 (MCID)，結果非常精確且可信。' },
                q9: { val: 'yes', reason: '本研究之受試者病況與照護資源條件，與我院胸腔內科或門診收治之穩定型慢阻肺病患相符，臨床適用性高。' },
                q10: { val: 'yes', reason: '研究完整納入了肺功能、生活品質 (SGRQ 量表) 與急性惡化次數等對臨床決策最關鍵的客觀結局指標。' },
                q11: { val: 'yes', reason: '太極運動無侵入性，且無發生任何肌肉骨骼受傷之嚴重不良事件，效益遠大於訓練場地與教練指導之微薄成本。' }
            };

            // Loop through each and check the radio button, update answer state, and show reasoning
            Object.keys(mockAppraisals).forEach(qId => {
                const item = mockAppraisals[qId];
                checklistAnswers[qId] = item.val;
                
                const radioEl = document.getElementById(`${qId}-${item.val}`);
                if (radioEl) {
                    radioEl.checked = true;
                }

                const reasonEl = document.getElementById(`ai-reason-${qId}`);
                if (reasonEl) {
                    reasonEl.style.display = 'flex';
                    reasonEl.innerHTML = `<i class="fa-solid fa-robot"></i> <div><strong>AI 評讀理由：</strong>${item.reason}</div>`;
                }
            });

            calculateScore();
            alert('🧬 AI 智慧文獻評讀解析完成！已自動填寫 CASP RCT 評量表並產出研判理由！');
        });
    }
}

window.clearAiAppraisal = () => {
    const textEl = document.getElementById('abstract-text');
    if (textEl) textEl.value = '';
    renderChecklist(activeChecklistType);
};

function renderChecklist(type) {
    const container = document.getElementById('checklist-questions-container');
    container.innerHTML = '';
    
    const questions = CHECKLIST_QUESTIONS[type];
    checklistAnswers = {}; // Clear old answers
 
    let currentSection = '';
 
    questions.forEach((q, idx) => {
        // Render section header if changed
        if (q.section !== currentSection) {
            currentSection = q.section;
            const secHeader = document.createElement('div');
            secHeader.className = 'checklist-section-title';
            secHeader.textContent = currentSection;
            container.appendChild(secHeader);
        }
 
        // Render question row
        const row = document.createElement('div');
        row.className = 'question-row';
        row.innerHTML = `
            <div class="question-text-box">
                <div class="question-number">${idx + 1}</div>
                <div class="question-details">
                    <div><strong>${q.text}</strong></div>
                    <div class="question-help">${q.help}</div>
                </div>
            </div>
            <div class="radio-group">
                <label class="radio-option">
                    <input type="radio" name="${q.id}" id="${q.id}-yes" value="yes" onchange="answerQuestion('${q.id}', 'yes')"> 
                    <span>是 (Yes)</span>
                </label>
                <label class="radio-option">
                    <input type="radio" name="${q.id}" id="${q.id}-cant" value="cant" onchange="answerQuestion('${q.id}', 'cant')"> 
                    <span>難以決定 (Can't Tell)</span>
                </label>
                <label class="radio-option">
                    <input type="radio" name="${q.id}" id="${q.id}-no" value="no" onchange="answerQuestion('${q.id}', 'no')"> 
                    <span>否 (No)</span>
                </label>
            </div>
            <div class="ai-reasoning-box" id="ai-reason-${q.id}" style="display: none;"></div>
        `;
        container.appendChild(row);
    });
 
    calculateScore();
}
 
window.answerQuestion = (qId, value) => {
    checklistAnswers[qId] = value;
    calculateScore();
};

function calculateScore() {
    const questions = CHECKLIST_QUESTIONS[activeChecklistType];
    const totalQuestions = questions.length;
    
    let score = 0;
    let answeredCount = 0;

    questions.forEach(q => {
        const val = checklistAnswers[q.id];
        if (val) {
            answeredCount++;
            if (val === 'yes') score += 2;
            else if (val === 'cant') score += 1;
        }
    });

    const maxScore = totalQuestions * 2;
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    
    // Update Score UI
    document.getElementById('appraisal-percentage').textContent = `${percentage}%`;
    document.getElementById('appraisal-fraction').textContent = `已評估 ${answeredCount}/${totalQuestions} 項 (得分: ${score}/${maxScore})`;
    document.getElementById('appraisal-progress-bar').style.width = `${percentage}%`;

    // Quality Rating
    const ratingBadge = document.getElementById('appraisal-quality-badge');
    if (answeredCount === 0) {
        ratingBadge.textContent = '待評估';
        ratingBadge.className = 'grade-badge very-low';
    } else if (percentage >= 80) {
        ratingBadge.textContent = '高文獻效度 (High Quality)';
        ratingBadge.className = 'grade-badge high';
    } else if (percentage >= 60) {
        ratingBadge.textContent = '中等文獻效度 (Moderate Quality)';
        ratingBadge.className = 'grade-badge moderate';
    } else {
        ratingBadge.textContent = '低文獻效度 (Low Quality)';
        ratingBadge.className = 'grade-badge low';
    }
}


// 4. GRADE Evidence Synthesizer Logic
let gradeState = {
    studyDesign: 'rct', // rct or obs
    bias: 0,
    inconsistency: 0,
    indirectness: 0,
    imprecision: 0,
    pubBias: 0,
    largeEffect: 0,
    doseResponse: 0,
    confounders: 0
};

function initGradeSynthesizer() {
    // Listen for study design selection
    const designSelect = document.getElementById('grade-study-design');
    designSelect.addEventListener('change', (e) => {
        gradeState.studyDesign = e.target.value;
        calculateGrade();
    });

    // Setup interactive checkbox actions
    const checkConfigs = [
        { id: 'grade-bias-serious', key: 'bias', val: -1 },
        { id: 'grade-bias-vserious', key: 'bias', val: -2, group: 'bias' },
        { id: 'grade-inconsistency', key: 'inconsistency', val: -1 },
        { id: 'grade-indirectness', key: 'indirectness', val: -1 },
        { id: 'grade-imprecision', key: 'imprecision', val: -1 },
        { id: 'grade-pubbias', key: 'pubBias', val: -1 },
        { id: 'grade-large-effect', key: 'largeEffect', val: 1 },
        { id: 'grade-vlarge-effect', key: 'largeEffect', val: 2, group: 'large' },
        { id: 'grade-doseresponse', key: 'doseResponse', val: 1 },
        { id: 'grade-confounders', key: 'confounders', val: 1 }
    ];

    checkConfigs.forEach(cfg => {
        const checkbox = document.getElementById(cfg.id);
        checkbox.addEventListener('change', (e) => {
            // Handle exclusive grouping (like serious bias vs very serious bias)
            if (cfg.group === 'bias' && e.target.checked) {
                document.getElementById('grade-bias-serious').checked = false;
            } else if (cfg.id === 'grade-bias-serious' && e.target.checked) {
                document.getElementById('grade-bias-vserious').checked = false;
            }
            
            if (cfg.group === 'large' && e.target.checked) {
                document.getElementById('grade-large-effect').checked = false;
            } else if (cfg.id === 'grade-large-effect' && e.target.checked) {
                document.getElementById('grade-vlarge-effect').checked = false;
            }

            // Sync state values
            updateGradeStateFromUi();
            calculateGrade();
        });
    });

    calculateGrade();
}

function updateGradeStateFromUi() {
    gradeState.bias = document.getElementById('grade-bias-vserious').checked ? -2 : 
                      (document.getElementById('grade-bias-serious').checked ? -1 : 0);
    
    gradeState.inconsistency = document.getElementById('grade-inconsistency').checked ? -1 : 0;
    gradeState.indirectness = document.getElementById('grade-indirectness').checked ? -1 : 0;
    gradeState.imprecision = document.getElementById('grade-imprecision').checked ? -1 : 0;
    gradeState.pubBias = document.getElementById('grade-pubbias').checked ? -1 : 0;
    
    gradeState.largeEffect = document.getElementById('grade-vlarge-effect').checked ? 2 : 
                             (document.getElementById('grade-large-effect').checked ? 1 : 0);
    
    gradeState.doseResponse = document.getElementById('grade-doseresponse').checked ? 1 : 0;
    gradeState.confounders = document.getElementById('grade-confounders').checked ? 1 : 0;
}

function calculateGrade() {
    // Initial certainty score
    // RCT = 4 (High), Observational = 2 (Low)
    let score = gradeState.studyDesign === 'rct' ? 4 : 2;
    
    // Apply down/up factors
    const downgrades = gradeState.bias + gradeState.inconsistency + gradeState.indirectness + gradeState.imprecision + gradeState.pubBias;
    const upgrades = gradeState.largeEffect + gradeState.doseResponse + gradeState.confounders;
    
    score = score + downgrades + upgrades;
    
    // Bounds check
    if (score > 4) score = 4;
    if (score < 1) score = 1;

    // Reposition dynamic GRADE pointer
    const pointer = document.getElementById('grade-meter-pointer');
    if (pointer) {
        pointer.style.left = `${(score - 1) * 25 + 12.5}%`;
    }

    // Display values
    document.getElementById('grade-score-downgrade').textContent = downgrades;
    document.getElementById('grade-score-upgrade').textContent = `+${upgrades}`;
    
    const levelBadge = document.getElementById('grade-score-badge');
    const recText = document.getElementById('grade-recommendation');
    
    if (score === 4) {
        levelBadge.textContent = '高 (High Certainty)';
        levelBadge.className = 'grade-badge high';
        recText.innerHTML = '<strong>臨床應用推薦</strong>：證據非常可信，後續研究極不可能改變現有療效評估。建議作為臨床常規決策依據（<strong>強推薦 Strong Recommendation</strong>）。';
    } else if (score === 3) {
        levelBadge.textContent = '中 (Moderate Certainty)';
        levelBadge.className = 'grade-badge moderate';
        recText.innerHTML = '<strong>臨床應用推薦</strong>：證據中等可信，後續研究可能對其療效評估產生重要影響，並可能改變現有評估結論（<strong>條件推薦 Weak/Conditional Recommendation</strong>）。';
    } else if (score === 2) {
        levelBadge.textContent = '低 (Low Certainty)';
        levelBadge.className = 'grade-badge low';
        recText.innerHTML = '<strong>臨床應用推薦</strong>：證據可信度較低，後續研究非常可能對療效評估產生重大影響，且現有評估極可能改變。建議謹慎應用（<strong>弱/不推薦 Weak/No Recommendation</strong>）。';
    } else {
        levelBadge.textContent = '極低 (Very Low Certainty)';
        levelBadge.className = 'grade-badge very-low';
        recText.innerHTML = '<strong>臨床應用推薦</strong>：證據極度不可信，任何療效估算都非常不確定。強烈建議在獲取更多高質量證據前，<strong>不應將其列為臨床常規實踐</strong>。';
    }

    // Dynamically build tailored medical EBM SDM statements based on score and preset
    let sdmText = "";
    const isTaichi = currentPicoData.p && (currentPicoData.p.includes("慢性阻塞") || currentPicoData.p.includes("COPD"));
    const isToothbrush = currentPicoData.p && (currentPicoData.p.includes("牙菌斑") || currentPicoData.p.includes("牙齦"));
    const isPeg = currentPicoData.p && (currentPicoData.p.includes("大腸鏡") || currentPicoData.p.includes("PEG"));

    if (isTaichi) {
        if (score >= 3) {
            sdmText = '「阿伯，根據最新的研究證據，練太極拳對於改善您的慢性阻塞性肺疾病（COPD）是有明確幫助的。走 6 分鐘可以多走大約 32 公尺，呼吸也會變順。太極拳沒有副作用、非常安全，建議您可以在按時吸藥之外，每天搭配做 30 分鐘的太極拳運動喔！」';
        } else {
            sdmText = '「阿伯，雖然有太極拳改善 COPD 的說法，但目前的臨床證據品質較為不足。如果您要做太極運動，請務必量力而為，一旦感到喘或胸悶要立刻休息，不要勉強，安全第一。」';
        }
    } else if (isToothbrush) {
        if (score >= 3) {
            sdmText = '「您好，實證研究顯示，使用電動牙刷再加上沖牙機，比起單純用電動牙刷，能更顯著減少您牙菌斑的堆積並改善牙齦發炎。這兩者搭配使用是安全且有效的，建議您可以搭配作為日常潔牙的常規習慣。」';
        } else {
            sdmText = '「您好，目前關於合併使用電動牙刷與沖牙機的科學證據強度還不夠高。雖然兩者都對清潔有益，但若使用沖牙機時有牙齦疼痛或出血，請調整沖水強度並向牙醫師諮詢。」';
        }
    } else if (isPeg) {
        if (score >= 3) {
            sdmText = '「您好，根據臨床實證，大腸鏡檢查前服用低劑量（1公升）聚乙二醇清腸藥並搭配補充足量水分，其清腸效果與標準 2公升藥物一樣乾淨，且病人喝藥的痛苦感與噁心感顯著降低。建議您可以優先選用 1公升低劑量清腸方案，以提升舒適度。」';
        } else {
            sdmText = '「您好，目前關於 1公升與 2公升清腸藥效果對比的證據品質仍有爭議。為了確保大腸鏡檢查的準確度，請務必嚴格遵循護理衛教的喝藥與清腸程序，確保腸道完全乾淨。」';
        }
    } else {
        if (score === 4) {
            sdmText = '「根據最高品質的研究證據，本療法療效非常明確，建議您可以將其列為首選的常規治療，這對您的復原最安全、也最有效益。」';
        } else if (score === 3) {
            sdmText = '「根據現有中等品質的證據，本療法對大多數人有效，但仍有少數不確定性。建議您可以考慮採用，若有任何不適隨時反應。」';
        } else if (score === 2) {
            sdmText = '「目前研究證據品質較低，表示療效尚未完全獲得臨床證實。我們會跟您一起審慎評估，若非必要不強制建議採用。」';
        } else {
            sdmText = '「目前這項治療的科學證據極不充足，療效非常不確定。為了您的安全，不建議您將其作為常規治療手段。」';
        }
    }

    const sdmEl = document.getElementById('grade-sdm-translation');
    if (sdmEl) {
        sdmEl.innerHTML = `<i class="fa-solid fa-comments"></i> <strong>病患共享決策 (SDM) 口語解釋：</strong>${sdmText}`;
    }
}


// 5. EBM Report Compiler and Printing
function initReportGenerator() {
    const printBtn = document.getElementById('btn-print-report');
    printBtn.addEventListener('click', () => {
        window.print();
    });
}

function compileEbmReport() {
    // Current date
    const today = new Date().toISOString().substring(0, 10);
    document.getElementById('rep-date').textContent = today;
    
    // PICO
    document.getElementById('rep-p').textContent = currentPicoData.p || '（未填寫）';
    document.getElementById('rep-i').textContent = currentPicoData.i || '（未填寫）';
    document.getElementById('rep-c').textContent = currentPicoData.c || '（未填寫）';
    document.getElementById('rep-o').textContent = currentPicoData.o || '（未填寫）';
    
    // PubMed Query
    document.getElementById('rep-query').textContent = document.getElementById('pubmed-query-string').textContent;
    
    // Critical Appraisal
    const qBadge = document.getElementById('appraisal-quality-badge');
    const repQuality = document.getElementById('rep-quality');
    repQuality.textContent = qBadge.textContent;
    repQuality.className = qBadge.className;
    
    const checklistTypeMap = { rct: '隨機對照試驗 (CASP RCT)', sr: '系統性文獻回顧 (CASP SR)', diag: '診斷性試驗 (CASP Diagnostic)' };
    document.getElementById('rep-checklist-type').textContent = checklistTypeMap[activeChecklistType];
    document.getElementById('rep-score-fraction').textContent = document.getElementById('appraisal-fraction').textContent;
    
    // GRADE level
    const gBadge = document.getElementById('grade-score-badge');
    const repGrade = document.getElementById('rep-grade-level');
    repGrade.textContent = gBadge.textContent;
    repGrade.className = gBadge.className;
    
    document.getElementById('rep-rec').innerHTML = document.getElementById('grade-recommendation').innerHTML;

    // Sync SDM text
    document.getElementById('rep-sdm').innerHTML = document.getElementById('grade-sdm-translation').innerHTML;
}

window.copyEmrSummary = () => {
    const today = new Date().toISOString().substring(0, 10);
    const pVal = currentPicoData.p || 'N/A';
    const iVal = currentPicoData.i || 'N/A';
    const cVal = currentPicoData.c || 'N/A';
    const oVal = currentPicoData.o || 'N/A';
    const query = document.getElementById('pubmed-query-string').textContent || 'N/A';
    
    const checklistTypeMap = { rct: 'CASP RCT', sr: 'CASP SR', diag: 'CASP Diagnostic' };
    const appraisalType = checklistTypeMap[activeChecklistType] || 'CASP Appraisal';
    const appraisalFraction = document.getElementById('appraisal-fraction').textContent || 'N/A';
    const appraisalQuality = document.getElementById('appraisal-quality-badge').textContent || 'N/A';
    
    const gradeLevel = document.getElementById('grade-score-badge').textContent || 'N/A';
    const gradeRec = document.getElementById('grade-recommendation').innerText || 'N/A';
    
    // Get SDM text
    const sdmEl = document.getElementById('grade-sdm-translation');
    const sdmText = sdmEl ? sdmEl.innerText.replace('病患共享決策 (SDM) 口語解釋：', '') : 'N/A';

    const emrSummaryText = `==================================================
[EBM Clinical Consultation Summary / Progress Note]
Date: ${today}
Institution: Tri-Service General Hospital, Clinical Pathology Division
==================================================
1. Clinical Question (PICO Formulation):
   - P: ${pVal}
   - I: ${iVal}
   - C: ${cVal}
   - O: ${oVal}

2. Search Strategy (PubMed Query):
   - ${query}

3. Critical Appraisal (${appraisalType}):
   - Appraisal Score & Progress: ${appraisalFraction}
   - Methodological Validity: ${appraisalQuality}

4. Evidence Synthesis (GRADE Certainty):
   - Certainty Rating: ${gradeLevel}
   - Clinical Recommendation: ${gradeRec}

5. Patient Communication (SDM Plain Language):
   - Clinician Script: ${sdmText}

==================================================
Clinician Signature: ________________________
Supervisor Signature: ________________________
==================================================`;

    navigator.clipboard.writeText(emrSummaryText).then(() => {
        alert('📋 臨床電子病歷 (EMR-ready SOAP) 摘要已複製至剪貼簿！\n您可以直接貼上至醫院資訊系統 (HIS) 病程紀錄中。');
    }).catch(err => {
        alert('複製失敗，請手動複製報告頁面內容。');
    });
};
