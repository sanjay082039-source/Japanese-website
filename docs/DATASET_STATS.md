# 📊 Japanese AI Tutor - Dataset Statistics & Profiling Report

**Total Processed Examples:** 33  
**Training Split:** 26 (78.8%)  
**Validation Split:** 3 (9.1%)  
**Test Split:** 4 (12.1%)  

---

## 1. Category Distribution

| Competency Category | Example Count | Percentage |
| :--- | :---: | :---: |
| `clarification_handling` | 2 | 6.1% |
| `context_dependent_questions` | 1 | 3.0% |
| `general_knowledge_and_chat` | 2 | 6.1% |
| `grammar_and_particles` | 2 | 6.1% |
| `jlpt_practice_n1` | 2 | 6.1% |
| `jlpt_practice_n2` | 2 | 6.1% |
| `jlpt_practice_n3` | 2 | 6.1% |
| `jlpt_practice_n4` | 2 | 6.1% |
| `jlpt_practice_n5` | 2 | 6.1% |
| `multiturn_dialogue` | 2 | 6.1% |
| `polite_and_casual_styles` | 1 | 3.0% |
| `sentence_correction` | 2 | 6.1% |
| `translation_en_to_ja` | 3 | 9.1% |
| `translation_ja_to_en` | 4 | 12.1% |
| `uncertainty_acknowledgment` | 2 | 6.1% |
| `vocabulary_and_kanji` | 2 | 6.1% |

---

## 2. Language & Query Modality Distribution

| Language Modality | Count | Description |
| :--- | :---: | :--- |
| **Bilingual (JA + EN)** | 23 (63.9%) | Learner queries matching this language profile |
| **English Primary** | 9 (25.0%) | Learner queries matching this language profile |
| **Japanese Primary** | 4 (11.1%) | Learner queries matching this language profile |

---

## 3. Data Provenance & Human Review

| Provenance Tag | Count | Quality Status |
| :--- | :---: | :--- |
| `human_verified` | 18 | ✅ Verified by native/senior reviewer |
| `synthetic` | 15 | 🤖 Generated / under review |

---

## 4. Open-Source Licensing Compliance

| License | Count | Commercial / Permissive Status |
| :--- | :---: | :--- |
| `Apache-2.0` | 30 | ✅ Approved Open-Source License |
| `CC-BY 2.0 FR` | 3 | ✅ Approved Open-Source License |

---

## 5. Turn Length Metrics

| Split | Avg User Chars | Min-Max User | Avg Assistant Chars | Min-Max Assistant |
| :--- | :---: | :---: | :---: | :---: |
| **Train** | 60.6 | 26 - 132 | 383.3 | 75 - 820 |
| **Val** | 78.0 | 59 - 112 | 496.7 | 272 - 707 |
| **Test** | 77.2 | 65 - 94 | 536.2 | 443 - 629 |
