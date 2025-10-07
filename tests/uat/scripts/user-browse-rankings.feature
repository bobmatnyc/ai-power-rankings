# Feature: Browse AI Tool Rankings
# As a user interested in AI tools
# I want to view the latest AI power rankings
# So that I can discover and evaluate trending AI tools

Feature: Browse AI Tool Rankings

  Background:
    Given I am on the AI Power Ranking homepage
    And the rankings data is loaded from the production database

  Scenario: View current top AI tools
    When I navigate to the rankings page
    Then I should see a list of AI tools ranked by power score
    And the top 3 tools should be prominently displayed
    And each tool should show:
      | Field | Required |
      | Tool Name | Yes |
      | Power Score | Yes |
      | Category | Yes |
      | Description | Yes |
      | Logo/Icon | Yes |

  Scenario: Business Value - Discover trending tools
    Given I want to find currently popular AI tools
    When I view the rankings page
    Then I should immediately see which tools are gaining traction
    And the UI should highlight new or rising tools
    And I should be able to quickly assess tool popularity

  Scenario: Access tool details for decision-making
    Given I am viewing the rankings list
    When I click on a specific tool
    Then I should navigate to the tool's detailed page
    And I should see comprehensive information including:
      | Information Type | Purpose |
      | Overview | Understand what the tool does |
      | Features | Evaluate capabilities |
      | Pricing | Assess affordability |
      | User Reviews | Gauge satisfaction |
      | Trending Data | See popularity trends |

  Scenario: Compare multiple AI tools
    Given I am evaluating different AI tools
    When I browse the rankings page
    Then I should be able to compare tools side-by-side visually
    And the ranking position should help guide my evaluation
    And I should see clear differentiators between tools
