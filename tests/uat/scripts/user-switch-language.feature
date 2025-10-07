# Feature: Multi-language Support (EN/JA)
# As a bilingual user or Japanese-speaking user
# I want to switch between English and Japanese
# So that I can read content in my preferred language

Feature: Multi-language Support

  Background:
    Given the application supports English (en) and Japanese (ja) locales
    And I am on the AI Power Ranking website

  Scenario: Switch from English to Japanese
    Given I am viewing the site in English
    When I click the language switcher
    And I select "日本語" (Japanese)
    Then the entire UI should update to Japanese
    And the URL should change to include "/ja/" path
    And all navigation elements should be in Japanese
    And tool names and descriptions should be localized where applicable

  Scenario: Switch from Japanese to English
    Given I am viewing the site in Japanese (/ja/)
    When I click the language switcher
    And I select "English"
    Then the entire UI should update to English
    And the URL should change to include "/en/" path
    And all content should be in English

  Scenario: Business Value - Expand to Japanese market
    Given the business goal is to serve Japanese AI enthusiasts
    When a Japanese user visits the site
    Then they should easily find and switch to Japanese
    And all critical information (rankings, tool details, articles) should be available in Japanese
    And the user experience should feel native, not translated

  Scenario: Maintain context across language switch
    Given I am viewing a specific tool's detail page in English
    When I switch to Japanese
    Then I should remain on the same tool's page
    And the URL structure should preserve the tool identifier
    And I should not lose my browsing context

  Scenario: Direct access to Japanese content
    Given I am a Japanese user sharing a link
    When I share a /ja/ URL with another user
    Then they should directly land on the Japanese version
    And the language preference should be automatically detected
