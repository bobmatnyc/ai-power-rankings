# Article Save Verification Test Report

**Generated:** 2025-09-17T01:08:49.403Z
**Test Environment:** http://localhost:3001

## 📊 Summary

- **Total Tests:** 11
- **Passed:** 7 (63.6%)
- **Failed:** 4 (36.4%)
- **Total Duration:** 56071ms (56.1s)

## ⚠️ Result: PARTIAL SUCCESS

Some tests failed. The database insert issue may still need attention.

## 📋 Test Suites

### Basic API Endpoint Tests

- **Tests:** 3
- **Passed:** 1
- **Failed:** 2
- **Duration:** 16536ms

#### Test Results

| Test | Status | Duration | Details |
|------|---------|----------|----------|
| Simple Text Ingestion | ❌ Fail | 7908ms | Missing required fields in response |
| Dry Run Test | ❌ Fail | 7981ms | Missing required fields in dry run response |
| URL Ingestion Test | ✅ Pass | 647ms | {"expectedError":true,"error":"Failed to extract content from URL: Failed to fetch URL: 404 Not Found"} |

### Edge Cases Tests

- **Tests:** 4
- **Passed:** 4
- **Failed:** 0
- **Duration:** 12587ms

#### Test Results

| Test | Status | Duration | Details |
|------|---------|----------|----------|
| Very Long Content | ✅ Pass | 4936ms | {"contentLength":27664} |
| Special Characters and Unicode | ✅ Pass | 7524ms | {} |
| Missing Required Fields | ✅ Pass | 85ms | {"validationError":true,"error":"Invalid request data"} |
| Invalid Ingestion Type | ✅ Pass | 42ms | {"validationError":true,"error":"Invalid request data"} |

### Performance Tests

- **Tests:** 2
- **Passed:** 2
- **Failed:** 0
- **Duration:** 12472ms

#### Test Results

| Test | Status | Duration | Details |
|------|---------|----------|----------|
| Normal Article Response Time | ✅ Pass | 7873ms | {"duration":7873,"toolsAnalyzed":0} |
| Large Content Processing Time | ✅ Pass | 4599ms | {"duration":4598,"contentSize":34440} |

### Data Validation Tests

- **Tests:** 2
- **Passed:** 0
- **Failed:** 2
- **Duration:** 14476ms

#### Test Results

| Test | Status | Duration | Details |
|------|---------|----------|----------|
| Article Data Structure Validation | ❌ Fail | 6778ms | Missing required fields: id, slug, title, content, createdAt |
| JSON Fields Validation | ❌ Fail | 7698ms | toolMentions should be an array |

## 🔧 Engineering Analysis

### Fixed Issues
- ✅ Ingestion type mapping (preprocessed → text)
- ✅ Data validation for field lengths
- ✅ Enhanced error handling
- ✅ JSON field formatting improvements

### Performance Metrics
- **Average Response Time:** 5097ms
- **All responses under 30s threshold:** Yes

