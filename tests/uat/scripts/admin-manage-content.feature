# Feature: Admin Content Management
# As a content administrator
# I want to manage tools, articles, and rankings
# So that I can maintain accurate and up-to-date information

Feature: Admin Content Management

  Background:
    Given I am authenticated as an administrator
    And I have access to the admin dashboard

  Scenario: Access admin dashboard
    Given I am logged in as an admin
    When I navigate to /en/admin
    Then I should see the admin dashboard
    And I should see sections for:
      | Section | Purpose |
      | Tools Management | Add/edit AI tools |
      | Article Management | Review/publish articles |
      | Database Status | Monitor data health |
      | Analytics | View site metrics |

  Scenario: Add new AI tool to database
    Given I want to add a newly launched AI tool
    When I access the Tools Management section
    And I click "Add New Tool"
    Then I should see a form to enter:
      | Field | Required |
      | Tool Name | Yes |
      | Category | Yes |
      | Description | Yes |
      | Website URL | Yes |
      | Logo/Icon | Yes |
      | Initial Power Score | No |
    When I submit the form
    Then the tool should be added to the database
    And it should appear in the rankings (if scored)

  Scenario: Review and approve articles
    Given new articles have been ingested from RSS feeds
    When I access the Article Management section
    Then I should see pending articles for review
    And I should be able to:
      | Action | Purpose |
      | Preview Article | Review content |
      | Edit Tool Associations | Ensure accuracy |
      | Approve for Publication | Make visible |
      | Delete/Archive | Remove irrelevant content |

  Scenario: Business Value - Maintain data quality
    Given the business depends on accurate tool information
    When I review articles and tools
    Then I should have tools to verify:
      | Quality Check | Importance |
      | Tool mentions are correctly identified | High |
      | No duplicate tools | High |
      | Articles link to correct tools | High |
      | Trending data is accurate | Medium |
    And the system should assist with automated quality checks

  Scenario: Monitor database health
    Given I need to ensure the platform is running smoothly
    When I view the Database Status dashboard
    Then I should see:
      | Metric | Purpose |
      | Total Tools Count | Track growth |
      | Total Articles Count | Content volume |
      | Recent Ingestions | Activity monitoring |
      | Error Logs | Identify issues |
      | Connection Status | Verify DB connectivity |

  Scenario: Security - Protected admin access
    Given the admin area contains sensitive operations
    When an unauthenticated user tries to access /en/admin
    Then they should be redirected to login
    And after authentication, they should return to admin
    When an authenticated non-admin user tries to access admin
    Then they should see an "Access Denied" message
