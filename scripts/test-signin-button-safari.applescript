-- Test Sign In Button and Capture Console Logs using Safari
-- This script opens Safari, navigates to localhost:3000, and tests the sign-in button

tell application "Safari"
	activate
	delay 1

	-- Open a new window with localhost:3000
	make new document with properties {URL:"http://localhost:3000"}
	delay 3

	-- Open Web Inspector
	tell application "System Events"
		tell process "Safari"
			-- Open Developer menu -> Show JavaScript Console (Cmd+Option+C)
			keystroke "c" using {command down, option down}
			delay 1
		end tell
	end tell

	delay 5

	-- Try to click the sign-in button using JavaScript
	tell current tab of window 1
		do JavaScript "
			// Log current environment
			console.log('=== Starting Sign In Button Test ===');
			console.log('Current URL:', window.location.href);
			console.log('ClerkProvider Available:', window.__clerkProviderAvailable);
			console.log('Clerk instance:', window.Clerk);

			// Find all buttons
			const buttons = Array.from(document.querySelectorAll('button'));
			console.log('Total buttons found:', buttons.length);

			buttons.forEach((btn, idx) => {
				const text = btn.textContent?.trim() || '';
				const visible = btn.offsetParent !== null;
				console.log(`Button ${idx + 1}: \"${text}\" (visible: ${visible})`);
			});

			// Find the Sign In button
			const signInButton = buttons.find(btn => {
				const text = btn.textContent?.toLowerCase() || '';
				return text.includes('sign') && text.includes('update');
			});

			if (signInButton) {
				console.log('✅ Found Sign In For Updates button');
				console.log('Button HTML:', signInButton.outerHTML);
				console.log('Button text:', signInButton.textContent);

				// Click the button
				console.log('Clicking button...');
				signInButton.click();

				// Wait and check for modal
				setTimeout(() => {
					const modal = document.querySelector('[role=\"dialog\"], .cl-modalContent, dialog, [aria-modal=\"true\"]');
					if (modal) {
						console.log('✅ Modal opened successfully');
						console.log('Modal HTML:', modal.outerHTML);
					} else {
						console.log('❌ No modal found after clicking button');
						console.log('Current Clerk state:', window.Clerk);
					}
				}, 2000);
			} else {
				console.log('❌ Could not find Sign In For Updates button');
			}

			'Test complete - check console for results';
		"
	end tell

	-- Keep the window open so user can see results
	display dialog "Test complete. Check the Safari Web Inspector console for results." buttons {"OK"} default button 1

end tell
