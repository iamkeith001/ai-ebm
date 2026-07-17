// EBM Assistant Core Logic
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initPicoBuilder();
    initPubmedSearch();
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

    // Recompute GRADE outputs so SDM/recommendation reflect the latest PICO data
    if (targetTab === 'grade') {
        calculateGrade();
    }

    // If switching to report tab, compile latest EBM data
    if (targetTab === 'report') {
        calculateGrade();
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
        i_mesh: '("Toothbrushing"[Mesh] OR "Electric Toothbrush") AND ("Dental Devices, Home Care"[Mesh] OR "Oral Irrigator" OR "Water Flosser")',
        c: "單純使用電動牙刷 (Electric Toothbrush alone)",
        c_mesh: '"Toothbrushing"[Mesh] OR "Electric Toothbrush"',
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
        p_mesh: '"Colonoscopy"[Mesh] OR "Colonoscopies"',
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

// Clinical concept dictionary used by the PICO parser.
// Each entry maps surface terms (zh-TW + English) to a preferred PICO role and its
// NLM controlled vocabulary. Only concepts listed here are ever emitted as MeSH —
// unrecognised text is never guessed into a [Mesh] tag.
const CLINICAL_CONCEPTS = [
    // ---- Population / condition ----
    { role: 'p', terms: ['肥胖', '過重', '體重過重', 'obesity', 'overweight'],
      label: '肥胖或過重成人 (Obesity / Overweight)',
      mesh: '"Obesity"[Mesh] OR "Overweight"[Mesh] OR "Body Mass Index"[Mesh]',
      syn: ['Obesity, Abdominal', 'Weight Gain', 'Adiposity'] },
    { role: 'p', terms: ['糖尿病', 'diabetes'],
      label: '糖尿病患者 (Diabetes Mellitus)',
      mesh: '"Diabetes Mellitus"[Mesh] OR "Diabetes Mellitus, Type 2"[Mesh]',
      syn: ['Hyperglycemia', 'Glycated Hemoglobin', 'Insulin Resistance'] },
    { role: 'p', terms: ['高血壓', 'hypertension'],
      label: '高血壓患者 (Hypertension)',
      mesh: '"Hypertension"[Mesh] OR "Blood Pressure"[Mesh]',
      syn: ['Prehypertension', 'Antihypertensive Agents'] },
    { role: 'p', terms: ['慢性阻塞性肺', 'COPD', '肺阻塞'],
      label: '慢性阻塞性肺疾病患者 (COPD)',
      mesh: '"Pulmonary Disease, Chronic Obstructive"[Mesh] OR "COPD"',
      syn: ['COAD', 'Pulmonary Emphysema'] },
    { role: 'p', terms: ['牙齦炎', '牙菌斑', 'gingivitis', 'dental plaque'],
      label: '牙菌斑或牙齦炎患者 (Plaque / Gingivitis)',
      mesh: '"Dental Plaque"[Mesh] OR "Gingivitis"[Mesh]',
      syn: ['Gingival Diseases', 'Periodontal Index'] },
    { role: 'p', terms: ['大腸鏡', '結腸鏡', 'colonoscopy'],
      label: '接受大腸鏡檢查之患者 (Colonoscopy)',
      mesh: '"Colonoscopy"[Mesh]',
      syn: ['Sigmoidoscopy', 'Colorectal Neoplasms'] },
    { role: 'p', terms: ['失眠', 'insomnia'],
      label: '失眠患者 (Insomnia)',
      mesh: '"Sleep Initiation and Maintenance Disorders"[Mesh] OR "Insomnia"',
      syn: ['Sleep Quality', 'Sleep Wake Disorders'] },
    { role: 'p', terms: ['憂鬱', '抑鬱', 'depression'],
      label: '憂鬱症患者 (Depression)',
      mesh: '"Depression"[Mesh] OR "Depressive Disorder"[Mesh]',
      syn: ['Depressive Disorder, Major', 'Antidepressive Agents'] },
    { role: 'p', terms: ['下背痛', '腰痛', 'low back pain'],
      label: '下背痛患者 (Low Back Pain)',
      mesh: '"Low Back Pain"[Mesh] OR "Back Pain"[Mesh]',
      syn: ['Chronic Pain', 'Lumbar Vertebrae'] },
    { role: 'p', terms: ['孕婦', '懷孕', 'pregnan'],
      label: '孕產婦 (Pregnant Women)',
      mesh: '"Pregnancy"[Mesh] OR "Pregnant People"[Mesh]',
      syn: ['Prenatal Care', 'Pregnancy Outcome'] },

    // ---- Intervention ----
    { role: 'i', terms: ['針灸', '針刺', '電針', 'acupuncture'],
      label: '針灸療法 (Acupuncture Therapy)',
      mesh: '"Acupuncture Therapy"[Mesh] OR "Acupuncture"[Mesh] OR "Electroacupuncture"[Mesh]',
      syn: ['Acupuncture Points', 'Acupuncture, Ear', 'Auriculotherapy'] },
    { role: 'i', terms: ['中醫', '中藥', '傳統醫學', 'traditional chinese medicine'],
      label: '中醫藥治療 (Traditional Chinese Medicine)',
      mesh: '"Medicine, Chinese Traditional"[Mesh] OR "Drugs, Chinese Herbal"[Mesh]',
      syn: ['Medicine, East Asian Traditional', 'Herbal Medicine'] },
    { role: 'i', terms: ['太極', 'tai chi', 'taiji'],
      label: '太極運動療法 (Tai Chi)',
      mesh: '"Tai Ji"[Mesh] OR "Tai Chi"',
      syn: ['Mind-Body Exercise', 'Qigong'] },
    { role: 'i', terms: ['運動訓練', '有氧運動', '規律運動', 'exercise training'],
      label: '運動訓練 (Exercise Training)',
      mesh: '"Exercise"[Mesh] OR "Exercise Therapy"[Mesh]',
      syn: ['Physical Fitness', 'Resistance Training', 'Exercise Tolerance'] },
    { role: 'i', terms: ['飲食控制', '低熱量飲食', '生酮', 'diet therapy'],
      label: '飲食介入 (Dietary Intervention)',
      mesh: '"Diet, Reducing"[Mesh] OR "Caloric Restriction"[Mesh] OR "Diet Therapy"[Mesh]',
      syn: ['Diet, Ketogenic', 'Feeding Behavior', 'Energy Intake'] },
    { role: 'i', terms: ['電動牙刷', 'electric toothbrush'],
      label: '電動牙刷 (Electric Toothbrush)',
      mesh: '"Toothbrushing"[Mesh] OR "Electric Toothbrush" OR "Powered Toothbrush"',
      syn: ['Oral Hygiene', 'Dental Devices, Home Care'] },
    { role: 'i', terms: ['沖牙機', 'oral irrigator', 'water floss'],
      label: '沖牙機 (Oral Irrigator)',
      mesh: '"Dental Devices, Home Care"[Mesh] OR "Oral Irrigator" OR "Water Flosser"',
      syn: ['Dental Irrigator', 'Oral Hygiene'] },
    { role: 'i', terms: ['聚乙二醇', 'PEG', 'polyethylene glycol'],
      label: '聚乙二醇腸道準備 (Polyethylene Glycol)',
      mesh: '"Polyethylene Glycols"[Mesh] OR "Cathartics"[Mesh]',
      syn: ['Bowel Preparation', 'Sodium Picosulfate'] },
    { role: 'i', terms: ['認知行為治療', 'CBT', 'cognitive behavioral'],
      label: '認知行為治療 (CBT)',
      mesh: '"Cognitive Behavioral Therapy"[Mesh]',
      syn: ['Psychotherapy', 'Behavior Therapy'] },
    { role: 'i', terms: ['益生菌', 'probiotic'],
      label: '益生菌 (Probiotics)',
      mesh: '"Probiotics"[Mesh]',
      syn: ['Lactobacillus', 'Gastrointestinal Microbiome'] },
    { role: 'i', terms: ['疫苗', 'vaccin'],
      label: '疫苗接種 (Vaccination)',
      mesh: '"Vaccination"[Mesh] OR "Vaccines"[Mesh]',
      syn: ['Immunization', 'Immunization Schedule'] },

    // ---- Comparator ----
    { role: 'c', terms: ['西藥', '口服藥物', '藥物治療', 'pharmacotherapy'],
      label: '藥物治療 (Pharmacotherapy)',
      mesh: '"Drug Therapy"[Mesh]',
      syn: ['Anti-Obesity Agents', 'Prescription Drugs'] },
    { role: 'c', terms: ['安慰劑', 'placebo', '假針灸', 'sham'],
      label: '安慰劑或假處置 (Placebo / Sham)',
      mesh: '"Placebos"[Mesh] OR "Sham Treatment" OR "Placebo Effect"[Mesh]',
      syn: ['Double-Blind Method', 'Sham Acupuncture'] },
    { role: 'c', terms: ['常規照護', '標準治療', '一般照護', 'usual care', 'standard care'],
      label: '常規照護 (Usual Care)',
      mesh: '"Standard of Care"[Mesh] OR "Usual Care" OR "Control Groups"[Mesh]',
      syn: ['Control Group', 'No Treatment'] },
    { role: 'c', terms: ['手術', 'surgery', 'surgical'],
      label: '外科手術 (Surgery)',
      mesh: '"Surgical Procedures, Operative"[Mesh]',
      syn: ['Bariatric Surgery', 'Postoperative Complications'] },

    // ---- Outcome ----
    { role: 'o', terms: ['減肥', '減重', '體重下降', '瘦身', 'weight loss'],
      label: '體重減輕 (Weight Loss)',
      mesh: '"Weight Loss"[Mesh] OR "Weight Reduction Programs"[Mesh] OR "Body Weight Changes"[Mesh]',
      syn: ['Body Mass Index', 'Waist Circumference', 'Body Weight Maintenance'] },
    { role: 'o', terms: ['感染', 'infection'],
      label: '感染風險 (Infection)',
      mesh: '"Infections"[Mesh] OR "Infection Control"[Mesh]',
      syn: ['Cross Infection', 'Bacterial Infections', 'Sepsis'] },
    { role: 'o', terms: ['副作用', '不良反應', '不良事件', 'adverse effect', 'side effect'],
      label: '不良事件 (Adverse Events)',
      mesh: '"Drug-Related Side Effects and Adverse Reactions"[Mesh] OR "Adverse Effects"[Subheading]',
      syn: ['Treatment Outcome', 'Patient Safety', 'Risk Assessment'] },
    { role: 'o', terms: ['生活品質', 'quality of life', 'QoL'],
      label: '健康相關生活品質 (Quality of Life)',
      mesh: '"Quality of Life"[Mesh] OR "Health Status"[Mesh]',
      syn: ['Patient Reported Outcome Measures', 'SF-36'] },
    { role: 'o', terms: ['疼痛', 'pain relief', '止痛'],
      label: '疼痛緩解 (Pain Relief)',
      mesh: '"Pain Measurement"[Mesh] OR "Pain Management"[Mesh]',
      syn: ['Visual Analog Scale', 'Analgesia'] },
    { role: 'o', terms: ['死亡率', '存活', 'mortality', 'survival'],
      label: '死亡率或存活 (Mortality / Survival)',
      mesh: '"Mortality"[Mesh] OR "Survival Rate"[Mesh]',
      syn: ['Survival Analysis', 'Cause of Death'] },
    { role: 'o', terms: ['復發', 'recurrence', 'relapse'],
      label: '復發率 (Recurrence)',
      mesh: '"Recurrence"[Mesh]',
      syn: ['Secondary Prevention', 'Disease Progression'] },
    { role: 'o', terms: ['住院', 'hospitalization', '再入院'],
      label: '住院或再入院 (Hospitalization)',
      mesh: '"Hospitalization"[Mesh] OR "Patient Readmission"[Mesh]',
      syn: ['Length of Stay', 'Emergency Service, Hospital'] },
    { role: 'o', terms: ['血糖', 'HbA1c', '糖化血色素'],
      label: '血糖控制 (Glycemic Control)',
      mesh: '"Glycated Hemoglobin"[Mesh] OR "Blood Glucose"[Mesh]',
      syn: ['Glycemic Index', 'Hyperglycemia'] }
];

const PICO_ROLE_META = {
    p: { name: 'Patient / Population', badge: 'p-bg', hint: '請填寫患者族群或疾病狀態，例如「肥胖成人」' },
    i: { name: 'Intervention', badge: 'i-bg', hint: '請填寫欲評估的介入措施，例如「針灸療法」' },
    c: { name: 'Comparison', badge: 'c-bg', hint: '請填寫對照措施，例如「安慰劑」或「常規照護」' },
    o: { name: 'Outcome', badge: 'o-bg', hint: '請填寫可測量的臨床結局，例如「體重減輕」' }
};

// Derive the population concept from a stated BMI when no condition keyword appears.
function inferPopulationFromBmi(text) {
    const match = text.match(/BMI\s*[:：]?\s*(\d{1,2}(?:\.\d+)?)/i);
    if (!match) return null;
    const bmi = parseFloat(match[1]);
    if (bmi >= 30) {
        return {
            label: `肥胖成人 (Obesity, BMI ${bmi})`,
            mesh: '"Obesity"[Mesh] OR "Body Mass Index"[Mesh]',
            syn: ['Overweight', 'Adiposity', 'Weight Gain']
        };
    }
    if (bmi >= 24) {
        return {
            label: `過重成人 (Overweight, BMI ${bmi})`,
            mesh: '"Overweight"[Mesh] OR "Body Mass Index"[Mesh]',
            syn: ['Obesity', 'Adiposity', 'Weight Gain']
        };
    }
    return null;
}

// Scan free text for known clinical concepts and assemble a PICO draft.
// Returns { p, p_mesh, i, ... , matchedRoles, missingRoles, synonyms }.
function parseClinicalConcepts(text) {
    const lower = text.toLowerCase();
    const buckets = { p: [], i: [], c: [], o: [] };

    CLINICAL_CONCEPTS.forEach(concept => {
        const hit = concept.terms.some(term => lower.includes(term.toLowerCase()));
        if (!hit) return;
        if (buckets[concept.role].some(c => c.label === concept.label)) return;
        buckets[concept.role].push(concept);
    });

    if (buckets.p.length === 0) {
        const bmiConcept = inferPopulationFromBmi(text);
        if (bmiConcept) buckets.p.push(bmiConcept);
    }

    const result = { matchedRoles: [], missingRoles: [], synonyms: {} };

    Object.keys(PICO_ROLE_META).forEach(role => {
        // Keep at most two concepts per element; more than that makes the query unusable.
        const picked = buckets[role].slice(0, 2);
        if (picked.length === 0) {
            result[role] = '';
            result[`${role}_mesh`] = '';
            result.missingRoles.push(role);
            return;
        }
        result[role] = picked.map(c => c.label).join('、');
        result[`${role}_mesh`] = picked.map(c => `(${c.mesh})`).join(' OR ');
        result.synonyms[role] = picked.flatMap(c => c.syn || []).slice(0, 4);
        result.matchedRoles.push(role);
    });

    return result;
}

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
        meshSuggest.style.display = 'block';

        ['p', 'i', 'c', 'o'].forEach(role => {
            const field = document.getElementById(`pico-${role}`);
            const meshField = document.getElementById(`pico-${role}-mesh`);
            field.value = data[role];
            meshField.value = data[`${role}_mesh`];
            field.classList.remove('needs-input');
            meshField.classList.remove('needs-input');
        });

        setExtractionNotice('ok', 'fa-book-medical', '已載入範例題庫',
            '此題目取自會刊論文範例，PICO 拆解與 MeSH 對照為<strong>人工審定的標準答案</strong>，可直接送出檢索或自行修改。');

        updateSearchQuery();
        renderSynonyms(data.synonyms);
    };

    // Renders the status banner above the PICO table. `tone` drives the colour so a
    // partial or failed parse can never look like a success.
    window.setExtractionNotice = (tone, icon, title, bodyHtml) => {
        aiNotify.style.display = 'flex';
        aiNotify.className = `ai-notification ${tone}`;
        aiNotify.querySelector('.ai-notification-icon').innerHTML = `<i class="fa-solid ${icon}"></i>`;
        aiNotify.querySelector('.ai-notification-content').innerHTML =
            `<strong>${title}</strong>：${bodyHtml}`;
    };

    window.renderExtractionNotice = (parsed) => {
        const roleNames = { p: 'P 患者', i: 'I 介入', c: 'C 對照', o: 'O 結局' };
        const found = parsed.matchedRoles.map(r => roleNames[r]).join('、');
        const missing = parsed.missingRoles.map(r => roleNames[r]).join('、');

        if (parsed.matchedRoles.length === 0) {
            setExtractionNotice('error', 'fa-circle-exclamation', 'AI 無法辨識臨床概念',
                '這段描述中沒有辨識到系統收錄的臨床概念，因此<strong>未產生任何 MeSH 詞彙</strong>。請直接於下方欄位手動填寫 PICO，或改用上方範例問題。');
            return;
        }
        if (parsed.missingRoles.length === 0) {
            setExtractionNotice('ok', 'fa-circle-check', 'AI 萃取完成',
                `已為您識別出 ${found} 四項要素，並自動匹配 <strong>NLM MeSH 控制詞彙</strong>。此為<strong>自動辨識結果，非臨床判讀</strong>，送出檢索前請確認欄位內容符合您的問題。`);
            return;
        }
        setExtractionNotice('warn', 'fa-triangle-exclamation', 'AI 僅辨識出部分要素',
            `已識別 ${found}；<strong>${missing}</strong> 未能從描述中辨識，欄位留空待您補齊（系統不會臆測 MeSH 詞彙）。補齊後檢索字串會自動更新。`);
    };

    window.renderSynonyms = (synonyms) => {
        const synCard = document.getElementById('pico-synonyms-card');
        const synContainer = document.getElementById('synonyms-container');
        if (!synCard || !synContainer) return;

        const categories = {
            p: { label: '患者 (P) 建議詞', bg: 'p-bg' },
            i: { label: '介入 (I) 建議詞', bg: 'i-bg' },
            c: { label: '對照 (C) 建議詞', bg: 'c-bg' },
            o: { label: '結局 (O) 建議詞', bg: 'o-bg' }
        };

        synContainer.innerHTML = '';
        const hasAny = synonyms && Object.keys(categories)
            .some(k => synonyms[k] && synonyms[k].length > 0);
        synCard.style.display = hasAny ? 'block' : 'none';
        if (!hasAny) return;

        Object.keys(categories).forEach(catKey => {
            const list = synonyms[catKey];
            if (!list || list.length === 0) return;

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
                btn.addEventListener('click', () => addSynonym(catKey, syn));
                tagGroup.appendChild(btn);
            });

            row.appendChild(badge);
            row.appendChild(tagGroup);
            synContainer.appendChild(row);
        });
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
            inputEl.classList.remove('needs-input');
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
            return;
        }

        const parsed = parseClinicalConcepts(text);
        meshSuggest.style.display = 'block';

        Object.keys(PICO_ROLE_META).forEach(role => {
            const field = document.getElementById(`pico-${role}`);
            const meshField = document.getElementById(`pico-${role}-mesh`);
            field.value = parsed[role];
            meshField.value = parsed[`${role}_mesh`];
            field.placeholder = PICO_ROLE_META[role].hint;
            // Highlight the elements the parser could not resolve — they need a clinician.
            field.classList.toggle('needs-input', !parsed[role]);
            meshField.classList.toggle('needs-input', !parsed[`${role}_mesh`]);
        });

        renderExtractionNotice(parsed);
        renderSynonyms(parsed.synonyms);
        updateSearchQuery();
    });

    // Handle manual inputs and keyups
    const inputs = ['pico-p', 'pico-p-mesh', 'pico-i', 'pico-i-mesh', 'pico-c', 'pico-c-mesh', 'pico-o', 'pico-o-mesh'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('input', () => {
            if (el.value.trim()) el.classList.remove('needs-input');
            updateSearchQuery();
        });
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


// 2.5 PubMed Live Search (NCBI E-utilities, free & license-less)
const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const QUERY_PLACEHOLDER = '((患者/疾病主題詞)';

function initPubmedSearch() {
    document.getElementById('btn-search-pubmed').addEventListener('click', searchPubmed);
}

function setPubmedStatus(html, tone) {
    const el = document.getElementById('pubmed-search-status');
    el.style.display = 'block';
    el.className = `pubmed-status ${tone || ''}`;
    el.innerHTML = html;
}

async function searchPubmed() {
    const query = document.getElementById('pubmed-query-string').textContent.trim();
    if (!query || query.includes(QUERY_PLACEHOLDER)) {
        alert('請先輸入或萃取 PICO 資料以生成檢索字串！');
        return;
    }

    const listEl = document.getElementById('pubmed-results-list');
    listEl.innerHTML = '';
    setPubmedStatus('<i class="fa-solid fa-spinner fa-spin"></i> 正在檢索 PubMed 資料庫…', '');

    try {
        // Step 1: esearch — total count + top PMIDs by relevance
        const esearchUrl = `${EUTILS_BASE}/esearch.fcgi?db=pubmed&retmode=json&retmax=10&sort=relevance&term=${encodeURIComponent(query)}`;
        const esRes = await fetch(esearchUrl);
        if (!esRes.ok) throw new Error(`esearch HTTP ${esRes.status}`);
        const esData = await esRes.json();
        const count = parseInt(esData.esearchresult.count, 10) || 0;
        const pmids = esData.esearchresult.idlist || [];

        if (count === 0 || pmids.length === 0) {
            setPubmedStatus('<i class="fa-solid fa-circle-info"></i> 檢索完成：未命中任何文獻。建議放寬 MeSH 條件或移除部分 AND 欄位。', 'warn');
            return;
        }

        // Step 2: esummary — bibliographic info for top hits
        const esumUrl = `${EUTILS_BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${pmids.join(',')}`;
        const sumRes = await fetch(esumUrl);
        if (!sumRes.ok) throw new Error(`esummary HTTP ${sumRes.status}`);
        const sumData = await sumRes.json();

        setPubmedStatus(`<i class="fa-solid fa-circle-check"></i> 檢索完成：共命中 <strong>${count.toLocaleString()}</strong> 篇文獻，以下依相關性顯示前 ${pmids.length} 篇。`, 'ok');

        pmids.forEach((pmid, idx) => {
            const doc = sumData.result[pmid];
            if (!doc) return;
            const authors = (doc.authors || []).slice(0, 3).map(a => a.name).join(', ');
            const moreAuthors = (doc.authors || []).length > 3 ? ' 等' : '';
            const pubType = (doc.pubtype || []).join(' / ');

            const item = document.createElement('div');
            item.className = 'pubmed-result-item';
            item.innerHTML = `
                <div class="pubmed-result-rank">${idx + 1}</div>
                <div class="pubmed-result-body">
                    <a class="pubmed-result-title" href="https://pubmed.ncbi.nlm.nih.gov/${pmid}/" target="_blank" rel="noopener">${doc.title || '(無標題)'}</a>
                    <div class="pubmed-result-meta">
                        ${authors}${moreAuthors} — <em>${doc.fulljournalname || doc.source || ''}</em>, ${doc.pubdate || ''} ｜ PMID: ${pmid}${pubType ? ' ｜ ' + pubType : ''}
                    </div>
                </div>
                <button class="btn btn-secondary pubmed-import-btn" data-pmid="${pmid}">
                    <i class="fa-solid fa-file-import"></i> 帶入評讀
                </button>`;
            item.querySelector('.pubmed-import-btn').addEventListener('click', (e) => importAbstractForAppraisal(pmid, e.currentTarget));
            listEl.appendChild(item);
        });
    } catch (err) {
        setPubmedStatus(`<i class="fa-solid fa-triangle-exclamation"></i> 檢索失敗：${err.message}。請確認網路連線後重試（NCBI 免費 API 偶有流量限制，稍候幾秒再試即可）。`, 'error');
    }
}

async function importAbstractForAppraisal(pmid, btnEl) {
    const originalHtml = btnEl.innerHTML;
    btnEl.disabled = true;
    btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 取得摘要中…';
    try {
        const efetchUrl = `${EUTILS_BASE}/efetch.fcgi?db=pubmed&rettype=abstract&retmode=text&id=${pmid}`;
        const res = await fetch(efetchUrl);
        if (!res.ok) throw new Error(`efetch HTTP ${res.status}`);
        const text = (await res.text()).trim();
        if (!text) throw new Error('該文獻無可用摘要');

        document.getElementById('abstract-text').value = text;
        switchTab('appraisal');
    } catch (err) {
        alert(`無法取得摘要（PMID: ${pmid}）：${err.message}`);
    } finally {
        btnEl.disabled = false;
        btnEl.innerHTML = originalHtml;
    }
}


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

// --- Abstract analyser -------------------------------------------------------
// Reads the abstract the user actually pasted and surfaces verbatim evidence.
// It never answers a CASP item: appraisal is the clinician's judgement, and a
// wrong auto-answer would propagate into the GRADE rating and the EMR note.

// Some reviews never use the words "systematic review" but are unmistakable from
// their methods. Two or more of these markers is treated as a review.
const SR_METHOD_MARKERS = [
    { label: '檢索多個資料庫', re: /\b(searched|search strategy)\b.*\b(PubMed|MEDLINE|Embase|Cochrane|CINAHL|Web of Science|Scopus)\b|\b(PubMed|MEDLINE|Embase|Cochrane)\b.*\bwere searched\b/i },
    { label: '合併分析', re: /\b(pooled|pooling)\b/i },
    { label: '效應模型', re: /\b(random[-\s]effects?|fixed[-\s]effects?)\s+(model|meta)/i },
    { label: '異質性統計', re: /\b(heterogeneity|I\s*2\s*=|I²\s*=|Q statistic|tau\s*2)/i },
    { label: '森林圖', re: /\bforest plot\b/i },
    { label: '納入研究數', re: /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)\s+(trials|studies)\s+(were\s+)?(included|identified|pooled|eligible)/i }
];

// Ordered most-specific first; the first match wins.
const STUDY_DESIGN_PATTERNS = [
    { type: 'sr', label: '系統性回顧／統合分析 (Systematic Review / Meta-analysis)',
      re: /\b(systematic review|meta[-\s]?analys[ie]s)\b/i },
    { type: 'diag', label: '診斷準確性研究 (Diagnostic Accuracy Study)',
      re: /\b(diagnostic accuracy|sensitivity and specificity|reference standard|gold standard|likelihood ratio|ROC curve|area under the (ROC )?curve)\b/i },
    { type: 'rct', label: '隨機對照試驗 (Randomized Controlled Trial)',
      re: /\b(randomi[sz]ed controlled trial|randomi[sz]ed clinical trial|RCT|randomly (assigned|allocated|divided))\b/i }
];

// Designs that CASP RCT/SR/Diagnostic checklists do not fit.
const NON_TRIAL_DESIGNS = [
    { label: '類實驗設計 (Quasi-experimental)', re: /\bquasi[-\s]?experimental\b/i },
    { label: '世代研究 (Cohort study)', re: /\b(prospective |retrospective )?cohort (study|design)\b/i },
    { label: '病例對照研究 (Case-control study)', re: /\bcase[-\s]?control\b/i },
    { label: '橫斷面研究 (Cross-sectional study)', re: /\bcross[-\s]?sectional\b/i },
    { label: '單臂或前後測研究 (Single-arm / pre-post)', re: /\b(single[-\s]?arm|pre[-\s]?post|before[-\s]?and[-\s]?after)\b/i },
    { label: '動物或前臨床研究 (Animal / preclinical)', re: /\b(in rats|in mice|animal model|preclinical|rodent)\b/i },
    { label: '個案報告 (Case report / series)', re: /\bcase (report|series)\b/i }
];

// Per-checklist evidence probes. Each locates a real sentence in the abstract.
// Applicability items (local patients, cost, benefit-harm) are intentionally
// absent — an abstract cannot evidence them.
const ABSTRACT_SIGNALS = {
    rct: [
        { q: 'q1', label: '研究問題與族群', re: /\b(aim(ed)?|objective|purpose|we (investigated|evaluated|compared|assessed))\b/i },
        { q: 'q2', label: '隨機分配與分配隱匿', re: /\b(computer[-\s]generated|random(ly)?[-\s](number|sequence|assigned|allocated|divided)|block randomi[sz]|permuted block|allocation concealment|sealed (opaque )?envelope)\b/i },
        { q: 'q3', label: '追蹤完整性與 ITT', re: /\b(intention[-\s]to[-\s]treat|ITT|lost to follow[-\s]?up|withdrew|withdrawal|dropout|drop[-\s]?out|attrition|completed the (study|trial))\b/i },
        { q: 'q4', label: '盲檢', re: /\b(double[-\s]blind|single[-\s]blind|triple[-\s]blind|open[-\s]label|blinded|blinding|masked|masking)\b/i },
        { q: 'q5', label: '基線特徵', re: /\b(baseline characteristics|baseline (were|was) (similar|comparable)|no significant differences? at baseline)\b/i },
        { q: 'q6', label: '兩組其他處置是否相同', re: /\b(usual care|standard care|routine care|co[-\s]?intervention|both groups received)\b/i },
        { q: 'q7', label: '治療效果量', re: /\b(mean difference|risk ratio|relative risk|odds ratio|hazard ratio|NNT|absolute risk reduction|effect size)\b|[pP]\s*[<>=]\s*0?\.\d+/ },
        { q: 'q8', label: '精確度 (信賴區間)', re: /\b(95\s*%\s*(CI|confidence interval)|confidence intervals?)\b/i }
    ],
    sr: [
        { q: 'q1', label: '研究問題', re: /\b(aim(ed)?|objective|purpose|we (reviewed|searched|evaluated))\b/i },
        { q: 'q2', label: '檢索的資料庫', re: /\b(PubMed|MEDLINE|Embase|EMBASE|Cochrane|CINAHL|Web of Science|Scopus|searched|search strategy|grey literature)\b/i },
        { q: 'q3', label: '納入研究的品質評估', re: /\b(risk of bias|Cochrane|Jadad|Newcastle[-\s]Ottawa|GRADE|quality assessment|methodological quality|RoB)\b/i },
        { q: 'q4', label: '合併的合理性與異質性', re: /\b(heterogeneit|I\s*2\s*=|I²|random[-\s]effects?|fixed[-\s]effects?|Q statistic|subgroup analys)/i },
        { q: 'q5', label: '合併後總體結果', re: /\b(pooled|overall effect|combined (estimate|analysis)|meta[-\s]?analys)/i },
        { q: 'q6', label: '精確度 (信賴區間)', re: /\b(95\s*%\s*(CI|confidence interval)|confidence intervals?|forest plot)\b/i }
    ],
    diag: [
        { q: 'q1', label: '與黃金標準的盲法比較', re: /\b(gold standard|reference standard|blinded|independently (assessed|interpreted))\b/i },
        { q: 'q2', label: '受試族群的代表性', re: /\b(consecutive|consecutively|suspected|spectrum|referred)\b/i },
        { q: 'q3', label: '參考標準的施行', re: /\b(all (patients|participants) (underwent|received)|verification)\b/i },
        { q: 'q4', label: '診斷準確性指標', re: /\b(sensitivit|specificit|likelihood ratio|predictive value|AUC|area under the (ROC )?curve|ROC)/i },
        { q: 'q5', label: '精確度 (信賴區間)', re: /\b(95\s*%\s*(CI|confidence interval)|confidence intervals?)\b/i }
    ]
};

// Abstract text is quoted back into the DOM — never trust it as markup.
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function setAbstractNotice(tone, icon, title, bodyHtml) {
    const el = document.getElementById('abstract-analysis-notice');
    if (!el) return;
    el.style.display = 'flex';
    el.className = `ai-notification ${tone}`;
    el.innerHTML = `<div class="ai-notification-icon"><i class="fa-solid ${icon}"></i></div>
                    <div class="ai-notification-content"><strong>${title}</strong>：${bodyHtml}</div>`;
}

// Split into sentences so a probe can cite the source line verbatim.
function splitAbstractSentences(text) {
    return text.replace(/\s+/g, ' ').trim()
        .split(/(?<=[.!?])\s+(?=[A-Z0-9("'])/)
        .map(s => s.trim())
        .filter(Boolean);
}

function analyzeAbstract(text) {
    const sentences = splitAbstractSentences(text);

    let design = null;
    for (const d of STUDY_DESIGN_PATTERNS) {
        const hit = sentences.find(s => d.re.test(s));
        if (hit) { design = { ...d, quote: hit }; break; }
    }

    // Fall back to review methodology when the label itself is absent.
    if (!design) {
        const markers = SR_METHOD_MARKERS.filter(m => m.re.test(text));
        if (markers.length >= 2) {
            const hit = sentences.find(s => markers.some(m => m.re.test(s)));
            design = {
                type: 'sr',
                label: `系統性回顧／統合分析 (依方法學特徵判定：${markers.map(m => m.label).join('、')})`,
                quote: hit || sentences[0]
            };
        }
    }

    const nonTrial = [];
    NON_TRIAL_DESIGNS.forEach(d => {
        const hit = sentences.find(s => d.re.test(s));
        if (hit) nonTrial.push({ ...d, quote: hit });
    });

    // A design word alone doesn't settle it — "randomly allocated" beats a bare
    // "cohort", but an explicit quasi-experimental label must never read as RCT.
    const explicitlyRandomised = /\brandomi[sz]ed|randomly (assigned|allocated|divided)\b/i.test(text);
    if (nonTrial.length && design && design.type === 'rct' && !explicitlyRandomised) design = null;

    const checklistType = design ? design.type : null;
    const probes = checklistType ? ABSTRACT_SIGNALS[checklistType] : [];
    const evidence = [];
    probes.forEach(p => {
        const hit = sentences.find(s => p.re.test(s));
        if (hit) evidence.push({ q: p.q, label: p.label, quote: hit });
    });

    return { design, nonTrial, checklistType, evidence, sentenceCount: sentences.length };
}

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

            const analysis = analyzeAbstract(abstractText);

            // No recognisable design: do not guess a checklist, do not tick anything.
            if (!analysis.checklistType) {
                const listed = analysis.nonTrial.map(d => d.label).join('、');
                setAbstractNotice('error', 'fa-circle-exclamation', 'AI 無法判定研究設計',
                    listed
                        ? `摘要中偵測到 <strong>${listed}</strong> 的字樣，這類設計<strong>不適用 CASP RCT／SR／診斷量表</strong>，因此未填入任何項目。請確認要評讀的文獻類型，或改用適合該設計的評讀工具（如 Newcastle-Ottawa、JBI）。`
                        : '摘要中未偵測到可辨識的研究設計字樣（RCT／系統性回顧／診斷準確性），因此<strong>未預填任何評讀項目</strong>。請自行選擇量表並手動評讀。');
                renderChecklist(activeChecklistType);
                return;
            }

            // Switch to the checklist the abstract actually calls for.
            activeChecklistType = analysis.checklistType;
            const targetCard = document.querySelector(`.checklist-type-card[data-type="${analysis.checklistType}"]`);
            if (targetCard) {
                cards.forEach(c => c.classList.remove('active'));
                targetCard.classList.add('active');
            }
            renderChecklist(analysis.checklistType);

            // Surface the located sentences as evidence — never as an answer.
            analysis.evidence.forEach(ev => {
                const box = document.getElementById(`ai-reason-${ev.q}`);
                if (!box) return;
                box.style.display = 'flex';
                box.className = 'ai-reasoning-box evidence';
                box.innerHTML = `<i class="fa-solid fa-quote-left"></i>
                    <div><strong>摘要中的相關文句（${ev.label}）：</strong>
                    <em>「${escapeHtml(ev.quote)}」</em>
                    <span class="evidence-caveat">— 供您判讀參考，系統不代為作答。</span></div>`;
            });

            const found = analysis.evidence.length;
            const total = ABSTRACT_SIGNALS[analysis.checklistType].length;
            const caution = analysis.nonTrial.length
                ? `<br><strong>注意</strong>：摘要同時出現 ${analysis.nonTrial.map(d => d.label).join('、')} 字樣，請再確認研究設計。`
                : '';
            setAbstractNotice(found ? 'ok' : 'warn', found ? 'fa-circle-check' : 'fa-triangle-exclamation',
                'AI 摘要解析完成',
                `依摘要文句判定為 <strong>${analysis.design.label}</strong>，已切換至對應量表，並標出 <strong>${found}/${total}</strong> 項可供判讀的文句。
                 <strong>各題答案與評分仍由您親自判定</strong>；摘要資訊有限，完整 CASP 評讀應以全文為準。${caution}`);

            calculateScore();
        });
    }
}

window.clearAiAppraisal = () => {
    const textEl = document.getElementById('abstract-text');
    if (textEl) textEl.value = '';
    const notice = document.getElementById('abstract-analysis-notice');
    if (notice) notice.style.display = 'none';
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

    // Quality Rating — only assert a verdict once every item has been judged.
    // A partial appraisal scores low purely because unanswered items count as
    // zero, which would otherwise read as "Low Quality" for the paper itself.
    const ratingBadge = document.getElementById('appraisal-quality-badge');
    if (answeredCount === 0) {
        ratingBadge.textContent = '待評估';
        ratingBadge.className = 'grade-badge very-low';
    } else if (answeredCount < totalQuestions) {
        ratingBadge.textContent = `評讀未完成 (${answeredCount}/${totalQuestions})`;
        ratingBadge.className = 'grade-badge incomplete';
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

// Single source of truth for "is this appraisal safe to put in a chart note?"
function getAppraisalCompletion() {
    const questions = CHECKLIST_QUESTIONS[activeChecklistType];
    const answered = questions.filter(q => checklistAnswers[q.id]).length;
    return { answered, total: questions.length, complete: answered === questions.length };
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

    // A printed copy must carry the caveat with it — printing is not blocked,
    // but the page may not leave here claiming an appraisal that wasn't done.
    const completion = getAppraisalCompletion();
    const warnEl = document.getElementById('rep-appraisal-warning');
    if (warnEl) {
        if (completion.complete) {
            warnEl.style.display = 'none';
        } else {
            warnEl.style.display = 'block';
            warnEl.innerHTML = completion.answered === 0
                ? '⚠ <strong>本報告尚未完成文獻評讀</strong>：CASP 各項目均未判定，「信度結論」不具參考價值，本報告僅為草稿，不得作為臨床決策依據。'
                : `⚠ <strong>本報告之文獻評讀尚未完成</strong>（已評 ${completion.answered}/${completion.total} 項）：未判定項目以 0 分計，得分因而偏低，不代表文獻品質不佳。本報告僅為草稿。`;
        }
    }
    
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
    // This text goes into a patient's chart under the hospital's name. Refuse to
    // emit a methodological-validity verdict that has not actually been made.
    const { answered, total, complete } = getAppraisalCompletion();
    if (!complete) {
        const remaining = total - answered;
        alert(answered === 0
            ? `無法複製至 EMR：尚未進行文獻評讀。\n\n病歷摘要會載明「Methodological Validity」，該欄位必須來自您實際完成的 CASP 評讀。請先於「CASP 文獻評讀」分頁完成全部 ${total} 項判定。`
            : `無法複製至 EMR：CASP 評讀尚未完成（已評 ${answered}/${total} 項，還有 ${remaining} 項未判定）。\n\n未完成的評讀會使分數偏低而被誤讀為文獻品質不佳。請完成剩餘項目後再複製。`);
        switchTab('appraisal');
        return;
    }

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
