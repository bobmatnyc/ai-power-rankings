tell application "Safari"
    activate

    -- Test homepage
    set URL of document 1 to "http://localhost:3011/en"
    delay 5

    -- Get page title
    set homeTitle to (name of document 1)

    -- Test navigation to different pages
    set testPages to {"http://localhost:3011/en/about", "http://localhost:3011/en/rankings", "http://localhost:3011/en/tools"}

    repeat with testURL in testPages
        set URL of document 1 to testURL
        delay 3
    end repeat

    -- Test language switching
    set URL of document 1 to "http://localhost:3011/de"
    delay 3
    set URL of document 1 to "http://localhost:3011/fr"
    delay 3
    set URL of document 1 to "http://localhost:3011/ja"
    delay 3

    -- Return to homepage
    set URL of document 1 to "http://localhost:3011/en"
    delay 2

end tell

return "Safari testing completed. Homepage title: " & homeTitle