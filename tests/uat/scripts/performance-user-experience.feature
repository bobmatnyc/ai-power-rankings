# Feature: Performance and User Experience
# As any user of the platform
# I want fast page loads and smooth interactions
# So that I can efficiently browse and discover AI tools

Feature: Performance and User Experience

  Background:
    Given I am accessing the platform from various networks and devices
    And the platform uses a production database with real data

  Scenario: Fast initial page load
    Given I visit the homepage for the first time
    When the page loads
    Then the First Contentful Paint (FCP) should be under 1.5 seconds
    And the Largest Contentful Paint (LCP) should be under 2.5 seconds
    And I should see meaningful content quickly

  Scenario: Smooth navigation between pages
    Given I am browsing the site
    When I click on a link to another page (e.g., rankings → tool detail → news)
    Then the navigation should feel instant or near-instant
    And there should be loading indicators for longer operations
    And I should not see flash of unstyled content (FOUC)

  Scenario: Business Value - Reduce bounce rate through performance
    Given slow websites lose users
    When I land on any page
    Then the page should load fast enough to keep my attention
    And interactive elements should respond immediately to clicks
    And the experience should encourage exploration, not frustration

  Scenario: Responsive design on mobile devices
    Given I am using a mobile phone (viewport: 375x667)
    When I access the homepage, rankings, or articles
    Then the layout should adapt perfectly to small screens
    And text should be readable without zooming
    And touch targets should be appropriately sized (min 44x44px)
    And navigation should be easily accessible via hamburger menu

  Scenario: Responsive design on tablet devices
    Given I am using a tablet (viewport: 768x1024)
    When I access any page
    Then the layout should use the available space efficiently
    And the experience should be between mobile and desktop
    And all features should be fully accessible

  Scenario: Handle database latency gracefully
    Given the database may occasionally be slow
    When I navigate to a data-heavy page (rankings, trending)
    Then I should see a loading state immediately
    And if data takes > 2 seconds, I should see a progress indicator
    And if an error occurs, I should see a friendly error message with retry option

  Scenario: No console errors breaking functionality
    Given I am using the site normally
    When I browse different pages and features
    Then there should be no JavaScript errors in the console
    And if there are warnings, they should not impact user experience
    And all features should work as expected without console errors

  Scenario: Images and assets load efficiently
    Given pages contain tool logos, article thumbnails, etc.
    When I view a page with images
    Then images should load progressively or with placeholders
    And images should be optimized (WebP, lazy loading)
    And broken images should have fallback states
    And the page should not reflow dramatically as images load
