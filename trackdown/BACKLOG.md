---
title: "AI Power Rankings Project Backlog"
last_updated: 2025-06-27
sprint_current: 1
---

# AI Power Rankings Project Backlog

## 🎯 Current Sprint (Sprint 1: JSON Migration)

### In Progress
- [ ] **[EP-001]** Migrate to Static JSON Database Architecture

### Ready for Development
- [ ] **[T-001]** Set up JSON database infrastructure
- [ ] **[T-002]** Create data migration scripts

## 📋 Product Backlog

### Epic: JSON Database Migration
- [ ] **[EP-001]** Migrate to Static JSON Database Architecture
  - [ ] **[T-001]** Set up JSON database infrastructure
  - [ ] **[T-002]** Create data migration scripts
  - [ ] **[T-003]** Migrate tools data to JSON
  - [ ] **[T-004]** Migrate rankings data to JSON
  - [ ] **[T-005]** Migrate news data to JSON
  - [ ] **[T-006]** Migrate companies data to JSON
  - [ ] **[T-007]** Convert tools API to use JSON
  - [ ] **[T-008]** Convert rankings API to use JSON
  - [ ] **[T-009]** Convert preview rankings API to use JSON
  - [ ] **[T-010]** Convert build rankings API to use JSON
  - [ ] **[T-011]** Convert news API to use JSON
  - [ ] **[T-012]** Update dashboard to use new APIs
  - [ ] **[T-013]** Update public site to use new APIs
  - [ ] **[T-014]** Remove Payload CMS dependencies
  - [ ] **[T-015]** Remove Supabase dependencies
  - [ ] **[T-016]** Create backup and rollback procedures
  - [ ] **[T-017]** Update documentation
  - [ ] **[T-018]** Deploy and verify production

---

## **[EP-001]** Migrate to Static JSON Database Architecture

**Type:** Epic  
**Priority:** Critical  
**Status:** In Progress  
**Sprint:** 1  

**Description:**
Migrate from the current hybrid Payload CMS + Supabase database architecture to a static JSON file-based system to improve development velocity and eliminate database synchronization issues.

**Goals:**
- Eliminate all database dependencies
- Enable version control for all data changes
- Simplify deployment process
- Speed up development iteration

**Success Criteria:**
- [ ] All data migrated from Payload CMS and Supabase
- [ ] All APIs working with JSON files
- [ ] Dashboard fully functional
- [ ] Public site displaying correct data
- [ ] Deployment successful without database
- [ ] Development velocity improved
- [ ] Schema validation in place
- [ ] Data backup strategy implemented

---

## **[T-001]** Set up JSON database infrastructure

**Type:** Task  
**Epic:** EP-001  
**Priority:** High  
**Story Points:** 5  
**Assignee:** @developer  
**Status:** In Progress  
**Sprint:** 1  

**Description:**
Install and configure the necessary packages and create the directory structure for the JSON database system.

**Acceptance Criteria:**
- [ ] Install lowdb, ajv, fs-extra packages
- [ ] Create directory structure under data/json/
- [ ] Define TypeScript interfaces for all schemas
- [ ] Create base repository classes
- [ ] Set up schema validation with ajv
- [ ] Add file locking mechanism for writes
- [ ] Create utility functions for atomic operations
- [ ] Set up proper error handling

**Technical Notes:**
- Use lowdb v7 with ESM support
- Create separate JSON files for each data type
- Implement proper TypeScript generics for repositories
- Use fs-extra for file operations with proper error handling

**Definition of Done:**
- [ ] All packages installed and configured
- [ ] Directory structure created
- [ ] Base classes implemented with tests
- [ ] Schema validation working
- [ ] Documentation updated

---

## **[T-002]** Create data migration scripts

**Type:** Task  
**Epic:** EP-001  
**Priority:** High  
**Story Points:** 8  
**Assignee:** @developer  
**Status:** Ready  
**Sprint:** 1  

**Description:**
Create scripts to export data from Payload CMS and Supabase, transform it to the new schema, and save as JSON files.

**Acceptance Criteria:**
- [ ] Export script for Payload CMS data
- [ ] Export script for Supabase data
- [ ] Data transformation logic for new schemas
- [ ] Validation of migrated data
- [ ] Progress tracking and error reporting
- [ ] Ability to resume failed migrations
- [ ] Data integrity verification

**Technical Notes:**
- Handle large datasets with streaming
- Create backups before migration
- Log all transformation decisions
- Validate against schemas after transformation

**Definition of Done:**
- [ ] Migration scripts created and tested
- [ ] Documentation for running migrations
- [ ] Test data successfully migrated
- [ ] Rollback procedure documented

---

## **[T-003]** Migrate tools data to JSON

**Type:** Task  
**Epic:** EP-001  
**Priority:** High  
**Story Points:** 5  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Migrate all tools data from the database to JSON files with proper schema validation.

**Acceptance Criteria:**
- [ ] Export all tools from database
- [ ] Transform to new Tool schema
- [ ] Save as tools.json with proper structure
- [ ] Create tools index for fast lookup
- [ ] Validate all required fields present
- [ ] Preserve all metadata and relationships
- [ ] Verify data integrity after migration

**Technical Notes:**
- Approximately 30-40 tools to migrate
- Include all nested data (info, metrics, etc.)
- Create ID mapping for relationships
- Generate slugs if missing

**Definition of Done:**
- [ ] All tools migrated successfully
- [ ] Data validated against schema
- [ ] Index file created
- [ ] Spot checks pass

---

## **[T-004]** Migrate rankings data to JSON

**Type:** Task  
**Epic:** EP-001  
**Priority:** High  
**Story Points:** 8  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Migrate all historical rankings data to period-based JSON files.

**Acceptance Criteria:**
- [ ] Export all rankings grouped by period
- [ ] Create separate JSON file for each period
- [ ] Transform to new RankingPeriod schema
- [ ] Include all factor scores
- [ ] Calculate and include movement data
- [ ] Mark current live ranking
- [ ] Create rankings index

**Technical Notes:**
- Split by period for better performance
- Include all v6 algorithm factor scores
- Preserve historical data integrity
- Handle missing or incomplete data

**Definition of Done:**
- [ ] All ranking periods migrated
- [ ] Current ranking identified
- [ ] Movement data calculated
- [ ] Schema validation passes

---

## **[T-005]** Migrate news data to JSON

**Type:** Task  
**Epic:** EP-001  
**Priority:** Medium  
**Story Points:** 5  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Migrate news articles to date-based JSON file structure.

**Acceptance Criteria:**
- [ ] Export all news articles
- [ ] Organize by year/month directories
- [ ] Transform to new schema
- [ ] Preserve all content and metadata
- [ ] Create news index for queries
- [ ] Handle large content appropriately
- [ ] Maintain URL slugs

**Technical Notes:**
- Consider splitting large articles
- Preserve HTML content structure
- Create efficient index structure
- Handle missing dates gracefully

**Definition of Done:**
- [ ] All news articles migrated
- [ ] Directory structure created
- [ ] Index allows date-based queries
- [ ] Content integrity verified

---

## **[T-006]** Migrate companies data to JSON

**Type:** Task  
**Epic:** EP-001  
**Priority:** Low  
**Story Points:** 3  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Migrate company data to JSON format.

**Acceptance Criteria:**
- [ ] Export all companies
- [ ] Transform to new schema
- [ ] Save as companies.json
- [ ] Create company index
- [ ] Preserve tool relationships
- [ ] Validate required fields

**Technical Notes:**
- Relatively small dataset
- Important for tool relationships
- Include all metadata

**Definition of Done:**
- [ ] All companies migrated
- [ ] Relationships preserved
- [ ] Schema validation passes

---

## **[T-007]** Convert tools API to use JSON

**Type:** Task  
**Epic:** EP-001  
**Priority:** High  
**Story Points:** 5  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Update /api/tools endpoints to read from JSON files instead of database.

**Acceptance Criteria:**
- [ ] GET /api/tools returns all tools
- [ ] GET /api/tools/[slug] returns single tool
- [ ] Filtering by category works
- [ ] Sorting options work
- [ ] Performance is acceptable
- [ ] Error handling implemented
- [ ] Backwards compatibility maintained

**Technical Notes:**
- Use ToolsRepository class
- Implement caching for performance
- Handle file read errors gracefully
- Maintain existing API contract

**Definition of Done:**
- [ ] All endpoints converted
- [ ] Tests updated and passing
- [ ] Performance benchmarked
- [ ] API documentation updated

---

## **[T-008]** Convert rankings API to use JSON

**Type:** Task  
**Epic:** EP-001  
**Priority:** High  
**Story Points:** 5  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Update rankings API endpoints to use JSON files.

**Acceptance Criteria:**
- [ ] GET /api/rankings returns current rankings
- [ ] GET /api/rankings/[period] returns specific period
- [ ] Movement data calculated correctly
- [ ] Factor scores included
- [ ] Performance optimized
- [ ] Error handling robust

**Technical Notes:**
- Read from current.json for latest
- Implement period lookup
- Cache frequently accessed data
- Handle missing periods gracefully

**Definition of Done:**
- [ ] All endpoints converted
- [ ] Movement calculations verified
- [ ] Performance acceptable
- [ ] Tests passing

---

## **[T-009]** Convert preview rankings API to use JSON

**Type:** Task  
**Epic:** EP-001  
**Priority:** High  
**Story Points:** 8  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Update the preview rankings API to work with JSON data for calculating new rankings.

**Acceptance Criteria:**
- [ ] Preview API reads tools from JSON
- [ ] Comparison with previous periods works
- [ ] Movement calculations accurate
- [ ] Change analysis functional
- [ ] Performance acceptable
- [ ] No database dependencies

**Technical Notes:**
- Complex logic to preserve
- Ensure algorithm calculations unchanged
- Handle date-based comparisons
- Maintain preview functionality

**Definition of Done:**
- [ ] Preview functionality working
- [ ] Comparisons accurate
- [ ] Performance tested
- [ ] Integration tested

---

## **[T-010]** Convert build rankings API to use JSON

**Type:** Task  
**Epic:** EP-001  
**Priority:** High  
**Story Points:** 5  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Update build rankings API to save rankings to JSON files instead of database.

**Acceptance Criteria:**
- [ ] Build API saves to period JSON files
- [ ] Updates current.json for live ranking
- [ ] Creates proper period structure
- [ ] Validates before saving
- [ ] Atomic write operations
- [ ] Backup before overwrite

**Technical Notes:**
- Use atomic writes
- Create period directory if needed
- Update indices after save
- Handle concurrent writes

**Definition of Done:**
- [ ] Build process saves to JSON
- [ ] Current ranking updated
- [ ] Atomic operations verified
- [ ] Error handling tested

---

## **[T-011]** Convert news API to use JSON

**Type:** Task  
**Epic:** EP-001  
**Priority:** Medium  
**Story Points:** 3  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Update news API endpoints to read from JSON files.

**Acceptance Criteria:**
- [ ] GET /api/news returns recent articles
- [ ] Pagination works correctly
- [ ] Date filtering functional
- [ ] Performance acceptable
- [ ] Content served correctly

**Technical Notes:**
- Read from index for listings
- Load full content on demand
- Implement efficient pagination
- Cache recent articles

**Definition of Done:**
- [ ] News API converted
- [ ] Pagination tested
- [ ] Performance verified
- [ ] Content integrity checked

---

## **[T-012]** Update dashboard to use new APIs

**Type:** Task  
**Epic:** EP-001  
**Priority:** High  
**Story Points:** 5  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Update all dashboard components to use the new JSON-based APIs.

**Acceptance Criteria:**
- [ ] Rankings manager works with new APIs
- [ ] Tools management functional
- [ ] News management working
- [ ] All CRUD operations work
- [ ] Error handling improved
- [ ] Loading states correct

**Technical Notes:**
- Update API calls
- Handle new response formats
- Improve error messages
- Test all workflows

**Definition of Done:**
- [ ] Dashboard fully functional
- [ ] All features tested
- [ ] Error handling verified
- [ ] User workflows smooth

---

## **[T-013]** Update public site to use new APIs

**Type:** Task  
**Epic:** EP-001  
**Priority:** High  
**Story Points:** 3  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Update public-facing pages to use new JSON-based APIs.

**Acceptance Criteria:**
- [ ] Homepage shows current rankings
- [ ] Tool pages load correctly
- [ ] News section works
- [ ] Performance maintained
- [ ] SEO preserved

**Technical Notes:**
- Minimal changes needed
- Ensure caching still works
- Verify static generation
- Test all public routes

**Definition of Done:**
- [ ] Public site working
- [ ] Performance verified
- [ ] SEO checked
- [ ] All pages tested

---

## **[T-014]** Remove Payload CMS dependencies

**Type:** Task  
**Epic:** EP-001  
**Priority:** Medium  
**Story Points:** 5  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Remove all Payload CMS code and dependencies from the project.

**Acceptance Criteria:**
- [ ] Remove Payload packages
- [ ] Delete Payload configuration
- [ ] Remove database migrations
- [ ] Clean up unused code
- [ ] Update environment variables
- [ ] Remove Payload routes

**Technical Notes:**
- Keep code in git history
- Document what was removed
- Update deployment configs
- Clean up types

**Definition of Done:**
- [ ] All Payload code removed
- [ ] Dependencies cleaned up
- [ ] Build successful
- [ ] No broken imports

---

## **[T-015]** Remove Supabase dependencies

**Type:** Task  
**Epic:** EP-001  
**Priority:** Medium  
**Story Points:** 3  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Remove Supabase client and all database query code.

**Acceptance Criteria:**
- [ ] Remove Supabase packages
- [ ] Delete database client code
- [ ] Remove connection logic
- [ ] Clean up queries
- [ ] Update environment docs

**Technical Notes:**
- Remove carefully
- Keep migration scripts for reference
- Update error handling
- Document removal

**Definition of Done:**
- [ ] Supabase removed
- [ ] No database calls remain
- [ ] Environment simplified
- [ ] Documentation updated

---

## **[T-016]** Create backup and rollback procedures

**Type:** Task  
**Epic:** EP-001  
**Priority:** High  
**Story Points:** 3  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Implement backup and rollback procedures for JSON data.

**Acceptance Criteria:**
- [ ] Automated backup before writes
- [ ] Manual backup command
- [ ] Rollback to previous version
- [ ] Backup rotation policy
- [ ] Restore procedures
- [ ] Verification tools

**Technical Notes:**
- Use git for version control
- Create backup directory
- Implement rotation policy
- Add restore scripts

**Definition of Done:**
- [ ] Backup system implemented
- [ ] Rollback tested
- [ ] Documentation complete
- [ ] Procedures verified

---

## **[T-017]** Update documentation

**Type:** Task  
**Epic:** EP-001  
**Priority:** Medium  
**Story Points:** 3  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Update all documentation to reflect the new JSON-based architecture.

**Acceptance Criteria:**
- [ ] Update PROJECT.md
- [ ] Update DATABASE.md
- [ ] Update WORKFLOW.md
- [ ] Update API documentation
- [ ] Add JSON architecture docs
- [ ] Update deployment guides

**Technical Notes:**
- Be thorough
- Include examples
- Document decisions
- Add troubleshooting

**Definition of Done:**
- [ ] All docs updated
- [ ] Examples working
- [ ] Reviewed for accuracy
- [ ] No stale information

---

## **[T-018]** Deploy and verify production

**Type:** Task  
**Epic:** EP-001  
**Priority:** Critical  
**Story Points:** 5  
**Assignee:** @developer  
**Status:** Backlog  
**Sprint:** 1  

**Description:**
Deploy the JSON-based system to production and verify everything works.

**Acceptance Criteria:**
- [ ] Deploy to production
- [ ] Verify all pages load
- [ ] Check API responses
- [ ] Monitor for errors
- [ ] Performance acceptable
- [ ] Rollback plan ready

**Technical Notes:**
- Deploy during low traffic
- Monitor closely
- Have rollback ready
- Test thoroughly

**Definition of Done:**
- [ ] Deployed successfully
- [ ] All features working
- [ ] Performance verified
- [ ] No critical errors