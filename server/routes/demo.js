const fs = require("fs");
const path = require("path");
const express = require("express");

const router = express.Router();
const DATA_PATH = path.join(__dirname, "..", "..", "data", "demo", "dashboard-data.json");

function readDemoData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

router.get("/overview", (req, res) => {
  const demo = readDemoData();
  res.json({
    note: demo.note,
    metrics: {
      totalPatients: demo.overview.patients,
      totalFollowups: demo.overview.followups,
      followupCompletionRate: demo.overview.completionRate,
      dataCompletenessRate: demo.overview.dataCompleteness,
      adverseEventCount: demo.overview.adverseEvents,
      doctorReviewed: demo.overview.doctorReviewed
    },
    trend: demo.visits.map((label, index) => ({
      label: label === "基线" ? "第0天基线" : label,
      phq9_score: demo.scaleTrends.phq9[index],
      gad7_score: demo.scaleTrends.gad7[index],
      sleep_score: demo.scaleTrends.sleep[index],
      tcm_symptom_score: demo.scaleTrends.tcmSymptoms[index]
    })),
    completionRates: demo.completion.map((item) => ({
      label: item.label,
      rate: item.rate
    })),
    adverseTypes: demo.adverseTypes,
    profile: {
      age: demo.ageDistribution,
      sex: demo.sexDistribution,
      symptoms: demo.symptomDistribution,
      syndromes: demo.syndromeDistribution,
      combinedMedicationRate: 21.7
    },
    qualityRadar: demo.quality,
    story: demo.singlePatient
  });
});

module.exports = router;
