# Branch restore manifest, 2026-11-12

- Generated: 2026-11-12T13:01:27Z
- origin/main: `8d01654356957ff0908dff7e9ac04a2f70179517`
- Branches: 206 total. A=112, B=56, C=30, D=8
- Scope: local branches in groups A-D of `branch-neon-inventory-2026-11-12.md`. Excludes `main` and every branch outside A-D (group E).

Groups:

- A: tip is an ancestor of origin/main.
- B: every commit is `-` in `git cherry origin/main <branch>`.
- C: PR MERGED and tip equals the PR head SHA.
- D: PR MERGED but tip differs from the PR head SHA.

Precedence when a branch fits more than one group: A, then B, then C, then D.

## Restore

```
git branch <name> <sha>
git worktree add <path> <name>   # only when a worktree path is listed
```

## Manifest

| branch | sha | group | PR | worktree |
|---|---|---|---|---|
| session/tm-ai-power-rankings-01 | 89948dccec1fa65bf0b53f2eed588c0c28e0f713 | A |  |  |
| verify-main-686cc035 | 89948dccec1fa65bf0b53f2eed588c0c28e0f713 | A |  |  |
| worktree-agent-a00dfe6ae3b97420e | d760ff8bd57bcfe996d84e884f451acb51823a76 | A |  |  |
| worktree-agent-a0229eb005ee11693 | 2a2ee235056bf20eb54b9969d8c9f5aa467b172e | A |  |  |
| worktree-agent-a05b9cd723baa5d13 | 923b82abae8b890e265b0f40e09202023d2d27c8 | A |  |  |
| worktree-agent-a06f18ca5898bc4f0 | f118c808a0164039fc436bf992a58cb4a22e60a1 | A |  |  |
| worktree-agent-a085815bb05398f52 | 1baf2dbe8a8a2756e64ee09efe6aaffa893fabc2 | A |  |  |
| worktree-agent-a0c1f5dc89619af94 | e7b7ea121ad068c1b21253d437f8b9a7893b7c59 | A |  |  |
| worktree-agent-a0fef0cfab3f11cec | 5f9566e182846525d43ef75660373db758c2da27 | A |  |  |
| worktree-agent-a1bf0eab7d0842784 | 8162aa0eddc3835f03b68523e51e8b22a44c4c5e | A |  |  |
| worktree-agent-a1cd5eaab649297ac | e06a8d64c0cb5c1e2f627712964c5f70d8a19215 | A |  |  |
| worktree-agent-a1d5bea0cccb96273 | bb0b8a818e638a9ecf2ce97103904b90a4d4fe0e | A |  |  |
| worktree-agent-a1f3ac8b64acf76e6 | c2cd51d8c952872019d53c9cc88e4603b3ace30c | A |  |  |
| worktree-agent-a1ff5160821c84192 | 8162aa0eddc3835f03b68523e51e8b22a44c4c5e | A |  |  |
| worktree-agent-a216ef601cb13ac6c | f2d25879c6fbabbdb7aa544503c6e76797e446eb | A |  |  |
| worktree-agent-a285a587626883498 | d7471173dc8ad7fd52ef94eb5c4cb03077fb8304 | A |  |  |
| worktree-agent-a28cb1597d285b4fe | 0a34943cd31a607c5c998e78303e31cf71abad46 | A |  |  |
| worktree-agent-a2b248723f73ac479 | 6fa4c3b4e1826e0ea4c93c9c3e9720e6d9c8cb90 | A |  |  |
| worktree-agent-a34f42ac2378148ff | 0e715a3268036e5540934d07670b0a659f9dd985 | A |  |  |
| worktree-agent-a35c01deed87dd7aa | ee9f806c7155fa4d3f2d29a7709d07aec51a72d6 | A |  |  |
| worktree-agent-a38281996793eb55d | b8c46d10175644164a91262810bef402a2b19828 | A |  |  |
| worktree-agent-a3be75f7711b94591 | f3b8f328c33de2ab59fce4725b7d2061d29b4938 | A |  |  |
| worktree-agent-a3bed0dbd1eafd388 | 798511bd5521a1a98b293f571d90f13489c37097 | A |  |  |
| worktree-agent-a3d4a4313e062ba7d | b36c00557eedd37f6d928adbfecb88503a21d1cc | A |  |  |
| worktree-agent-a41025d6f50efc0db | 09c2114ff2d981213720fb80750d564245f112d8 | A |  |  |
| worktree-agent-a41167e68707d8065 | 2f581a94fc6e701a2a91ffc0db6f151ffe21e052 | A |  |  |
| worktree-agent-a445e50bb47329a9e | a6d18bef4479943d7b8ea7e30db88ab524a064a4 | A |  |  |
| worktree-agent-a4612691bf487c35d | e7b382f6d27e375022ab1d2ebbb19331cfc9fe1e | A |  |  |
| worktree-agent-a47055920e4a7b1c1 | 7e6a2945bed11d20199d275e05d0dd4c995a42f7 | A |  |  |
| worktree-agent-a518256ffc8a6826e | d7471173dc8ad7fd52ef94eb5c4cb03077fb8304 | A |  |  |
| worktree-agent-a529a60a38a159f35 | a6d18bef4479943d7b8ea7e30db88ab524a064a4 | A |  |  |
| worktree-agent-a54f354ab3061fe35 | 74501bb2f539a7dbaf1cd86ace937d460d64aeb6 | A |  |  |
| worktree-agent-a56f9899fc55d4529 | d20a6ba03956f95007de34008a1337bdf6e3e1c9 | A |  |  |
| worktree-agent-a570df875e4a5e9e8 | efdc51a1c49ee38cab391e68c621c52bf3b974a4 | A |  |  |
| worktree-agent-a580ff34be6ef3edd | 24e15971351d82f196db48e5bad1bc9e8889aebc | A |  |  |
| worktree-agent-a587180bfce5313e2 | d7471173dc8ad7fd52ef94eb5c4cb03077fb8304 | A |  |  |
| worktree-agent-a591e7c0ef96ef1af | 89e70bff9eb6f4e1275c65db6bb6b4673019d961 | A |  |  |
| worktree-agent-a5accff4359761a74 | d7471173dc8ad7fd52ef94eb5c4cb03077fb8304 | A |  |  |
| worktree-agent-a5d7349b763a2d119 | 40f32da3fb30dea92e94400dc0c8dcba82dd67d1 | A |  |  |
| worktree-agent-a62a0d1e09ce1d988 | faee6a7baffac6710990b2a257c70fa25da370c7 | A |  |  |
| worktree-agent-a65030204c4723fbd | 2838fab9d6137de5fde98dcefcd513c4e73ebce9 | A |  |  |
| worktree-agent-a664cf8c32358bbf1 | e0f98f66b04a7ea9f542344079ba4a5c95e5912a | A |  |  |
| worktree-agent-a6ad441934cd03abf | 2fac24f39154e9402c5902aa454da1f459e368d1 | A |  |  |
| worktree-agent-a6e2a2c855b8fb596 | 73483a83736a0abd0c30d665a273ea746d695ed4 | A |  |  |
| worktree-agent-a6fc3c6b26f621eae | 8162aa0eddc3835f03b68523e51e8b22a44c4c5e | A |  |  |
| worktree-agent-a709d408c9216ffee | 50ca64c6e2fe7add0cdb0d900d6e5130b45981bb | A |  |  |
| worktree-agent-a74e3a293c10ae49b | 3cedaadaf3a65dfeaf53270fd4c68e5344e1cd77 | A |  |  |
| worktree-agent-a78cf11d7ec77a6b6 | 7a71a6ad39c9f558280f109b001bd3eb506a3b9d | A |  |  |
| worktree-agent-a7b618bba672dd874 | 3e2317b33757ed4b69ea2383fba274616b774714 | A |  |  |
| worktree-agent-a7d5711591808631f | 89e70bff9eb6f4e1275c65db6bb6b4673019d961 | A |  |  |
| worktree-agent-a80453b825dc8ed9e | e7b7ea121ad068c1b21253d437f8b9a7893b7c59 | A |  |  |
| worktree-agent-a83ec08c16dd34ed9 | 97847277ed113dbcec6528e61e98efca3bbb7d30 | A |  |  |
| worktree-agent-a84755095571b6cdb | 66b1801c387fa7fe8e29641fa4aadbc928965cd6 | A |  |  |
| worktree-agent-a87becab8d921f6af | 2a7a33be59fde24018abfc305e46a730973725f3 | A |  |  |
| worktree-agent-a8aedce537c9f2b9a | 98aad7b5efddd2039d68ee63712b94b5bb93cfb8 | A |  |  |
| worktree-agent-a8bd245f43ad23fd8 | 84ebcba9fadc11596a128b272dd6e0d2c40119ba | A |  |  |
| worktree-agent-a8d01e775cdb36c6f | b84b3184b62ea7a5ce0090d7a394fd8531deca86 | A |  |  |
| worktree-agent-a8ee94ff02f276a5f | 5b3f6d2a6877937f7382100177b048b43310f101 | A |  |  |
| worktree-agent-a9027065bfaf1e6b3 | 3ae06805aa11ff0ecb9832f9f779774401e2fdaa | A |  |  |
| worktree-agent-a9429777f0ce395c1 | 82489b330d962b1458c65085fe0c4db839e8a307 | A |  |  |
| worktree-agent-a95dcd137cdfaf88a | 89e70bff9eb6f4e1275c65db6bb6b4673019d961 | A |  |  |
| worktree-agent-a966279b154fb15d8 | d7471173dc8ad7fd52ef94eb5c4cb03077fb8304 | A |  |  |
| worktree-agent-a987eb6cce681ae55 | f50b2859c1ea2af3faa1bffb03c8e67f252ddd7f | A |  |  |
| worktree-agent-a9b532f37032f5f20 | 6c8da27084d4f5b5d0fa271e02545ea97f687cbf | A |  |  |
| worktree-agent-a9dd22bdc9d6f9a1f | e0f98f66b04a7ea9f542344079ba4a5c95e5912a | A |  |  |
| worktree-agent-a9f27a406e60111c7 | 7a71a6ad39c9f558280f109b001bd3eb506a3b9d | A |  |  |
| worktree-agent-aa1af7530e99ba7f2 | b8c46d10175644164a91262810bef402a2b19828 | A |  |  |
| worktree-agent-aa208f246c277d2b9 | 89e70bff9eb6f4e1275c65db6bb6b4673019d961 | A |  |  |
| worktree-agent-aa421a52dc82726f7 | 7bf41d6ea0df8833e964e1d3ff7a728bd750d626 | A |  |  |
| worktree-agent-aa4a3483e19590afb | efdc51a1c49ee38cab391e68c621c52bf3b974a4 | A |  |  |
| worktree-agent-aa4fc4f5ab6f3b30a | 2838fab9d6137de5fde98dcefcd513c4e73ebce9 | A |  |  |
| worktree-agent-aa931207f4fe3c4b6 | 76c3d37b569d458b86137b626a37da84b4c1cd49 | A |  |  |
| worktree-agent-aab7fe3f60fcb36b9 | 338f303bda4949a858a2588f5b43abfbdebe27c6 | A |  |  |
| worktree-agent-aaef72067f07045a6 | dc8aa3a53d919d0f1aec12ee31b6e0d13b6e6c03 | A |  |  |
| worktree-agent-aafc2078150b0d137 | 21781a3ebc39d293a04d4318e2bb4c416ec4bd5e | A |  |  |
| worktree-agent-ab2d7f829abe565b1 | 2a2ee235056bf20eb54b9969d8c9f5aa467b172e | A |  |  |
| worktree-agent-ab605115be0e50c24 | 2fac24f39154e9402c5902aa454da1f459e368d1 | A |  |  |
| worktree-agent-ab8f7bbbb9a6b52d5 | 5a6664b12d2f14f573ac6018b26c56f8f0dd9f25 | A |  |  |
| worktree-agent-ab963a35e69f3c709 | fe3a3e19a222ead5d2f1afcbf2d2c489d89f73e9 | A |  |  |
| worktree-agent-aba34eec8df97edea | ee9f806c7155fa4d3f2d29a7709d07aec51a72d6 | A |  |  |
| worktree-agent-abd750dce76006c7d | 2bf322a6f4518974c0133098e8b738431672d4b2 | A |  |  |
| worktree-agent-ac08bdcba53fbd780 | 74501bb2f539a7dbaf1cd86ace937d460d64aeb6 | A |  |  |
| worktree-agent-ac11417e22324b84c | c448739599a7f9a83d43f4488bc0239aaff2b577 | A |  |  |
| worktree-agent-ac29fe73c0982a40b | 472e735c33ab2cc7db1876ba7346339975bf3827 | A |  |  |
| worktree-agent-ac38a8215266eaf6a | 8162aa0eddc3835f03b68523e51e8b22a44c4c5e | A |  |  |
| worktree-agent-ac7301589f2c532bd | d2e4d95bec15f6f106941997f09bdef20733bb04 | A |  |  |
| worktree-agent-ac767b40cd885dc0c | 7bf41d6ea0df8833e964e1d3ff7a728bd750d626 | A |  |  |
| worktree-agent-ac861f85dfa799a85 | 89e70bff9eb6f4e1275c65db6bb6b4673019d961 | A |  |  |
| worktree-agent-ac9b19e2d7d73f8cf | 6fa4c3b4e1826e0ea4c93c9c3e9720e6d9c8cb90 | A |  |  |
| worktree-agent-acbb7ef27c948b9d1 | e0f98f66b04a7ea9f542344079ba4a5c95e5912a | A |  |  |
| worktree-agent-acd4cd3e25bf4c461 | 7bf41d6ea0df8833e964e1d3ff7a728bd750d626 | A |  |  |
| worktree-agent-ad21d13784337b249 | 89e70bff9eb6f4e1275c65db6bb6b4673019d961 | A |  |  |
| worktree-agent-ad27e14aeea0939bf | e7b382f6d27e375022ab1d2ebbb19331cfc9fe1e | A |  |  |
| worktree-agent-ad360d7795aa241d9 | f2d25879c6fbabbdb7aa544503c6e76797e446eb | A |  |  |
| worktree-agent-ad3f4d51cda749a3d | 73483a83736a0abd0c30d665a273ea746d695ed4 | A |  |  |
| worktree-agent-ad629471bf3609631 | 47361d1704593911b0ecc4589a428a8f8580d9da | A |  |  |
| worktree-agent-ad8eeef2c5aceb3c2 | 2f581a94fc6e701a2a91ffc0db6f151ffe21e052 | A |  |  |
| worktree-agent-ad920f5bbd08b9e3a | 50ca64c6e2fe7add0cdb0d900d6e5130b45981bb | A |  |  |
| worktree-agent-ada20602db2c8ce47 | b8c46d10175644164a91262810bef402a2b19828 | A |  |  |
| worktree-agent-adb5737aec01e28c1 | ee14fe5837062a9be4bbc23de7be31469f17210e | A |  |  |
| worktree-agent-adc969f4f2692a1f4 | bb0b8a818e638a9ecf2ce97103904b90a4d4fe0e | A |  |  |
| worktree-agent-addd676474df0e806 | 0a34943cd31a607c5c998e78303e31cf71abad46 | A |  |  |
| worktree-agent-adfb609e7a48770c3 | d7471173dc8ad7fd52ef94eb5c4cb03077fb8304 | A |  |  |
| worktree-agent-ae334ac5d6305c562 | 7d7ee99504dca4218537e811da18cf72d205ec7f | A |  |  |
| worktree-agent-ae37376b868452e65 | e7b7ea121ad068c1b21253d437f8b9a7893b7c59 | A |  |  |
| worktree-agent-ae499eb01df8cb87b | 5a59e2e85a5ab83becdd73e50db2d5837f419a55 | A |  |  |
| worktree-agent-aea1b132d606c45d4 | 0cec97f92a863322314f46300c7ef6248435aedb | A |  |  |
| worktree-agent-aee5e64e0e516fe20 | b84b3184b62ea7a5ce0090d7a394fd8531deca86 | A |  |  |
| worktree-agent-af271969998781f5b | 1baf2dbe8a8a2756e64ee09efe6aaffa893fabc2 | A |  |  |
| worktree-agent-af322ebd3a26fb211 | 0606329850f40a9db2584169e54b6ab46deda983 | A |  |  |
| worktree-agent-af49a42f064450da2 | 66b1801c387fa7fe8e29641fa4aadbc928965cd6 | A |  |  |
| worktree-agent-aff4c0a1857dbcff2 | 76c3d37b569d458b86137b626a37da84b4c1cd49 | A |  |  |
| chore/198-insights-preview-redeploy | db9e30ecdc935338d93114f27837d13ea745c255 | B | #439 |  |
| chore/restore-eslint-config | b3b93ef12c4d04eb0bd39618d3a5d100c8738e08 | B | #89 |  |
| dedup-entity-pre-319 | 5e3eb681bab662a211a6d1341dd685a91a141e7d | B |  |  |
| docs/174-ga4-baseline | 7ae8ffa08a9d9531199c26864df673d2a2815783 | B | #222 |  |
| docs/ia-audit-177 | dccbaf378963f8b71708089b9d825ff235a14626 | B | #205 |  |
| feat/179-paragraph-summary | 64c1098b7b61a0de3a0a480c57308b99391937fd | B | #273 |  |
| feat/184-hf-collector | 3cd49ac69d197e5133016c64cd340798c24d0a4e | B | #407 |  |
| feat/187-raw-mention-name | ef458ce977ca23feb4cd8054e8e17d6cb2855736 | B | #433 |  |
| feat/190-og-exemption | be57434485fcb80b93f55c1f9725667cc04a909b | B | #220 |  |
| feat/190d-parity | c5aef17d00399bc9ea5422927852b389d2c340c0 | B | #218 |  |
| feat/190e2b1-auth-parity | 49202d67b37863297329e60640851a0a75a90e70 | B | #224 |  |
| feat/190e2b2-authenticated-parity | 2c4117e27295abb0c74f83d6aa1d21f791fbf917 | B | #225 |  |
| feat/198-article-insight-templates | 5275a11067296d78ce42006dcdb4ef83ed667237 | B | #421 |  |
| feat/198-insights-launch-prep | 31cb91dbe3967766ed82fc134eb1709e81c3296d | B | #436 |  |
| feat/392-crawl-spend-capture | 2616ce7f20f33a37ba757ce35433f72ed01eb89c | B | #403 |  |
| feat/393-crawl-spend-dashboard | 5b03e19a071e5984e0d6d2dd032bd86902f6513e | B | #404 |  |
| feat/395-spend-soft-alert | 37b75669159f9ad8ca25733d707870b8a969c72b | B | #437 |  |
| feat/432-suspect-alias-rulings | 69e1f7cb485533cbb5b5f9030010608fa60e1053 | B | #438 |  |
| feat/95-point-in-time-compare | 01b7a088c932947d715dfa4923c12112cd24ad56 | B | #423 |  |
| feat/d1c-trending-harness-only | e338125ce2f554932e00463a53fac1020e436cfa | B | #418 |  |
| feat/design-agent-spike-178 | bf029c7eec13007f05095209c305793068423dfd | B | #204 |  |
| feat/ranking-regen-cron | 337d4ddc8942e61e515a374475ddb1d08b32cfd6 | B | #86 |  |
| feat/terminal-bench-agentic-signal-v7.9 | 95cb7a991253c8afc0c019606c80d5b3524d4dfd | B | #102 |  |
| fix/175-ga4-filter-search-events | 99896afef64cfce1c74ced0312a9a513d223941c | B | #229 |  |
| fix/197-board-noindex-filter | a562beb258f93d1a59337a12e31b1a4db76344ab | B | #431 |  |
| fix/197-perplexity-indexable | f0f0f05576f491e2321d85babba95bd044477fbf | B | #422 |  |
| fix/219-whats-new-recent-origin | 78c9dd469c557c710e11234598efa4c2494617c0 | B | #232 |  |
| fix/226-unauthorized-public-route | 6ddeb58a08f71b7919b75b41249eff9071a14009 | B | #227 |  |
| fix/233-search-term-redaction | 5288afac9562772293454f46688a958dbe6c24c7 | B | #234 |  |
| fix/239-utc-client-dates | 6ea1770afb1160ca3fed03dbffdb091f4d88f62b | B | #242 |  |
| fix/269-factor-key-lookup-dedup | 76bad8783aaa08878d90460ddcff54300f34610a | B | #399 |  |
| fix/280-stale-v76-text | 8c74e77ce70e7d63f2ca5fdf1e42afe3ef48a06a | B | #370 |  |
| fix/414-unlocalized-section-redirect | cbfc778aa74bee6d7ad59d2029a0249f756118b8 | B | #416 |  |
| fix/417-bare-section-redirect | 29c767f1cbbc28e9a317e505e3fbcd512fee8115 | B | #419 |  |
| fix/424-tool-meta-by-kind | 0736d40b2fb56acd6c32089d5b69a0176e6b6f52 | B | #430 | /Users/masa/trusty-mpm-projects/bobmatnyc/ai-power-rankings/.claude/worktrees/agent-a1f3ac8b64acf76e6 |
| fix/96-eslint-legacy-config-cascade | 5bf401183fa4883255a465eaef8971fc7c768ef1 | B | #107 |  |
| fix/admin-rankings-cache-path | 83d0c6062abe0fb5afeb17034f00ea45b651e9ef | B | #88 |  |
| fix/block-ttl-and-status-guard | 94ae194b25eb5dd74f89e25a576ae35a6a0b25bb | B | #131 |  |
| fix/codex-stale-survivor-text | 0e18c53aa3c84ad1cc61cb25b177f7744df58b66 | B | #411 |  |
| fix/content-correctness-cleanup | d11f7f9a8a82cff9b70ba856e86c36a05e7ef0cc | B | #84 |  |
| fix/current-route-metric-row-count | 420f49611f0ccd30d4bcf4878b2e0bff49459df0 | B | #412 |  |
| fix/d6e-hide-model-page | 0636ebfdecdba895f339229645f33d9791feb482 | B | #401 |  |
| fix/duplicate-link-sections | b81b0c477ab2293de3b6ad2a65ad064f216fddf8 | B | #123 |  |
| fix/glm-family-licence | acd26516cabdb61279e53eb8894465b3630818ff | B | #359 |  |
| fix/ingestion-freshness-gate | 8a329c07ca1b384561c80d89912b638a0dcaf5dd | B | #119 |  |
| fix/ingestion-gap-yield-detection | 7bfbfcab58d25e70c84141bb8e80878e2e2b21b2 | B | #110 |  |
| fix/ingestion-truncated-json-172 | 46c795a8133feea197c489afa4ce8aabd45f3bcf | B | #203 |  |
| fix/issue-104-partial-run-completed-at | 095a6f57fc4dae874c9e19056a1e147177f82e94 | B | #111 |  |
| fix/openrouter-model-id-172 | ca7c6b61b923a4d1d9887146a38e2124397aefdf | B | #173 |  |
| fix/reenable-skipped-test-suites-76 | 3524dd69aeb779a02e071d529f432733a18ee7da | B | #108 |  |
| fix/reference-link-quality | d912e00f2e276f5c79a773e836a32e2b8862331f | B | #130 |  |
| fix/regen-script-nodeenv-guard | 36b686bc16eeaffe9f85ece6431608f1ca71f45e | B | #91 |  |
| fix/t76-trending-history-boundary | bfc55ec76c674cf6c1ec89821f039a20b0b78df5 | B | #408 |  |
| fix/tool-taxonomy-gating-prune | d598c054b57b912a0866967b28274e7aa7eda6a7 | B | #85 |  |
| release/codex-redirect-hold | d443337a39d584ebc73fdfc0b996441e472f21c4 | B | #413 |  |
| test/ranking-algorithm-coverage | e1cb8e6515732258e4bf36c36c4af3ff03b27a6a | B | #90 |  |
| chore/ci-local-gate | b8f40e5334eaefa19cdba12a053235b0de0be701 | C | #165 |  |
| ci/101-publish-rankings-dispatch | a21a491a8bc368404827a787442b5832b5aa8a5f | C | #258 |  |
| feat/182-monthly-merge | b3db19d75bb153e1dd60f95cac7a4c4ef0cd2a6e | C | #358 |  |
| feat/187-catalogue-tool-lookup | a03d3a27922cfbfed2757b64bdb2c3c0c34bbca1 | C | #429 | /Users/masa/trusty-mpm-projects/bobmatnyc/ai-power-rankings/.claude/worktrees/agent-ad8eeef2c5aceb3c2 |
| feat/190c2-gradient-options | 8168cd0291ab8e9c7b4db2e75b06f14583c06832 | C | #217 |  |
| feat/190e1-public-parity | f15c273dc789674bde0741c47679818c908d17cd | C | #221 |  |
| feat/190e2a-admin-parity | 10f330464284353582402ea0133fda01557b94e2 | C | #223 |  |
| feat/191-release-d91-308s | 4c135767288ecb42623590532184b4b9d01b25f4 | C | #278 |  |
| feat/195-open-weight-filter | bf506368ce2ba9a9e10bb0bfdb742d0170d7eea3 | C | #435 |  |
| feat/207-search-empty-state | 64cfda8fcef708566ebe46c783b3e8663f19b5d6 | C | #236 |  |
| feat/329-model-list-metric-filter | 655ba4c9125ab46975357750363dcf5bb1e5b238 | C | #409 |  |
| feat/394-provider-balance-check | 4e50d54c3d7d872b77d264f451085906373c5d37 | C | #405 |  |
| feat/54-whats-new-index | 0b7efae4a29713cf25c78d793ba60ed3d2125681 | C | #240 |  |
| feat/95-point-in-time-metrics | 9915b7f567dc58f49b3aad55290813f0d41488fc | C | #377 |  |
| feat/d90-merge-duplicate-tools | b01304ae5aff88471ea79050d7c8a8066906e08f | C | #274 |  |
| feat/ga4-events-175 | 878d4b625cd4c644183ffe9ac1ea017b66f10b88 | C | #206 |  |
| feat/whats-new-auto-regenerate | 22cad3b23de4cd1b34b272ad1588cf6c5690154e | C | #168 |  |
| fix/0028-openclaw-guard | 431deb706992ae7933db57fcdf8c99a73ba92b6d | C | #376 |  |
| fix/231-whats-new-platform-items | 8e75747e39ed0f3c380761b5d9c0fbd221f9c266 | C | #235 |  |
| fix/237-timestamptz | 287bc504a120a015fddcc5239a9c9b48c108f943 | C | #262 |  |
| fix/290-tool-repo-writes | f936030257dcd3736800a8ee4a1d3a489c662593 | C | #295 |  |
| fix/367-provider-auth-blocks | c7961f8c5cd84a23a0a796fe82c46313c8e1e4e6 | C | #371 |  |
| fix/api-news-fail-closed | 588f10752ac88ec9f1fe1c4da493deb9b10037d1 | C | #170 |  |
| fix/auth-routing-hardening | c8f98ff5436f3351b3240257e93eacdbbef2acb2 | C | #247 |  |
| fix/codex-merge-and-metrics | 55e74c56bbe9dca1b7b9e1d51e5dbda63e67503a | C | #410 | /Users/masa/trusty-mpm-projects/bobmatnyc/ai-power-rankings/.claude/worktrees/agent-a5accff4359761a74 |
| fix/d6e-models-copy | abeaf4b4fecb222ab5ad5a809944c4fd8894e8c9 | C | #406 |  |
| fix/deploy-ajv-formats-eresolve | 13c3cd057b2a35042c6435250894e602867655be | C | #400 |  |
| fix/ingestion-billing-errors-fail-run | 8f57cb22430b49cab5de6ea0fe207bcab7f33c80 | C | #169 |  |
| fix/run-row-finalization | 869e1f7a2523786f1ad39c29e1462be91e80041a | C | #129 |  |
| fix/sitemap-news-articles | 3f43ef592bfa6ff143cb23a9e35b32eab4fdd24e | C | #163 |  |
| chore/drop-google-api-key | a52efca5a18f0f22015c4e0449bf8071d5545b2a | D | #365 |  |
| feat/186-per-list-rankings | a7b78cca64fac768d37a6db98eb426f99af84caf | D | #279 |  |
| feat/198-insights-monthly | 66cae7f8777ed9c2d0cd7fbfa691b55fa90670f7 | D | #379 |  |
| feat/198-insights-rss | 60adc6408a0b1eafe35146c25d58561c1a194ea2 | D | #380 |  |
| feat/198-insights-weekly-slice | 3970b180081dc8f9d12d4fed1dbf11271d5ce26c | D | #378 |  |
| feat/314-activate-productivity-rows | 00ba6fe6d408557a7d78105aeef534bf66b2438f | D | #385 | /Users/masa/trusty-mpm-projects/bobmatnyc/ai-power-rankings/tmp/wt-314-activate |
| fix/seo-self-canonical | 00fa8fc62916921b33785050f101a68eae1e8b2f | D | #158 |  |
| perf/368-edge-cache-public-pages | 20dce16bd02e4ce0aaadb293f7f3fb350952cd6e | D | #369 | /Users/masa/trusty-mpm-projects/bobmatnyc/ai-power-rankings/tmp/wt-369 |

## Machine-readable (`name sha`)

```
session/tm-ai-power-rankings-01 89948dccec1fa65bf0b53f2eed588c0c28e0f713
verify-main-686cc035 89948dccec1fa65bf0b53f2eed588c0c28e0f713
worktree-agent-a00dfe6ae3b97420e d760ff8bd57bcfe996d84e884f451acb51823a76
worktree-agent-a0229eb005ee11693 2a2ee235056bf20eb54b9969d8c9f5aa467b172e
worktree-agent-a05b9cd723baa5d13 923b82abae8b890e265b0f40e09202023d2d27c8
worktree-agent-a06f18ca5898bc4f0 f118c808a0164039fc436bf992a58cb4a22e60a1
worktree-agent-a085815bb05398f52 1baf2dbe8a8a2756e64ee09efe6aaffa893fabc2
worktree-agent-a0c1f5dc89619af94 e7b7ea121ad068c1b21253d437f8b9a7893b7c59
worktree-agent-a0fef0cfab3f11cec 5f9566e182846525d43ef75660373db758c2da27
worktree-agent-a1bf0eab7d0842784 8162aa0eddc3835f03b68523e51e8b22a44c4c5e
worktree-agent-a1cd5eaab649297ac e06a8d64c0cb5c1e2f627712964c5f70d8a19215
worktree-agent-a1d5bea0cccb96273 bb0b8a818e638a9ecf2ce97103904b90a4d4fe0e
worktree-agent-a1f3ac8b64acf76e6 c2cd51d8c952872019d53c9cc88e4603b3ace30c
worktree-agent-a1ff5160821c84192 8162aa0eddc3835f03b68523e51e8b22a44c4c5e
worktree-agent-a216ef601cb13ac6c f2d25879c6fbabbdb7aa544503c6e76797e446eb
worktree-agent-a285a587626883498 d7471173dc8ad7fd52ef94eb5c4cb03077fb8304
worktree-agent-a28cb1597d285b4fe 0a34943cd31a607c5c998e78303e31cf71abad46
worktree-agent-a2b248723f73ac479 6fa4c3b4e1826e0ea4c93c9c3e9720e6d9c8cb90
worktree-agent-a34f42ac2378148ff 0e715a3268036e5540934d07670b0a659f9dd985
worktree-agent-a35c01deed87dd7aa ee9f806c7155fa4d3f2d29a7709d07aec51a72d6
worktree-agent-a38281996793eb55d b8c46d10175644164a91262810bef402a2b19828
worktree-agent-a3be75f7711b94591 f3b8f328c33de2ab59fce4725b7d2061d29b4938
worktree-agent-a3bed0dbd1eafd388 798511bd5521a1a98b293f571d90f13489c37097
worktree-agent-a3d4a4313e062ba7d b36c00557eedd37f6d928adbfecb88503a21d1cc
worktree-agent-a41025d6f50efc0db 09c2114ff2d981213720fb80750d564245f112d8
worktree-agent-a41167e68707d8065 2f581a94fc6e701a2a91ffc0db6f151ffe21e052
worktree-agent-a445e50bb47329a9e a6d18bef4479943d7b8ea7e30db88ab524a064a4
worktree-agent-a4612691bf487c35d e7b382f6d27e375022ab1d2ebbb19331cfc9fe1e
worktree-agent-a47055920e4a7b1c1 7e6a2945bed11d20199d275e05d0dd4c995a42f7
worktree-agent-a518256ffc8a6826e d7471173dc8ad7fd52ef94eb5c4cb03077fb8304
worktree-agent-a529a60a38a159f35 a6d18bef4479943d7b8ea7e30db88ab524a064a4
worktree-agent-a54f354ab3061fe35 74501bb2f539a7dbaf1cd86ace937d460d64aeb6
worktree-agent-a56f9899fc55d4529 d20a6ba03956f95007de34008a1337bdf6e3e1c9
worktree-agent-a570df875e4a5e9e8 efdc51a1c49ee38cab391e68c621c52bf3b974a4
worktree-agent-a580ff34be6ef3edd 24e15971351d82f196db48e5bad1bc9e8889aebc
worktree-agent-a587180bfce5313e2 d7471173dc8ad7fd52ef94eb5c4cb03077fb8304
worktree-agent-a591e7c0ef96ef1af 89e70bff9eb6f4e1275c65db6bb6b4673019d961
worktree-agent-a5accff4359761a74 d7471173dc8ad7fd52ef94eb5c4cb03077fb8304
worktree-agent-a5d7349b763a2d119 40f32da3fb30dea92e94400dc0c8dcba82dd67d1
worktree-agent-a62a0d1e09ce1d988 faee6a7baffac6710990b2a257c70fa25da370c7
worktree-agent-a65030204c4723fbd 2838fab9d6137de5fde98dcefcd513c4e73ebce9
worktree-agent-a664cf8c32358bbf1 e0f98f66b04a7ea9f542344079ba4a5c95e5912a
worktree-agent-a6ad441934cd03abf 2fac24f39154e9402c5902aa454da1f459e368d1
worktree-agent-a6e2a2c855b8fb596 73483a83736a0abd0c30d665a273ea746d695ed4
worktree-agent-a6fc3c6b26f621eae 8162aa0eddc3835f03b68523e51e8b22a44c4c5e
worktree-agent-a709d408c9216ffee 50ca64c6e2fe7add0cdb0d900d6e5130b45981bb
worktree-agent-a74e3a293c10ae49b 3cedaadaf3a65dfeaf53270fd4c68e5344e1cd77
worktree-agent-a78cf11d7ec77a6b6 7a71a6ad39c9f558280f109b001bd3eb506a3b9d
worktree-agent-a7b618bba672dd874 3e2317b33757ed4b69ea2383fba274616b774714
worktree-agent-a7d5711591808631f 89e70bff9eb6f4e1275c65db6bb6b4673019d961
worktree-agent-a80453b825dc8ed9e e7b7ea121ad068c1b21253d437f8b9a7893b7c59
worktree-agent-a83ec08c16dd34ed9 97847277ed113dbcec6528e61e98efca3bbb7d30
worktree-agent-a84755095571b6cdb 66b1801c387fa7fe8e29641fa4aadbc928965cd6
worktree-agent-a87becab8d921f6af 2a7a33be59fde24018abfc305e46a730973725f3
worktree-agent-a8aedce537c9f2b9a 98aad7b5efddd2039d68ee63712b94b5bb93cfb8
worktree-agent-a8bd245f43ad23fd8 84ebcba9fadc11596a128b272dd6e0d2c40119ba
worktree-agent-a8d01e775cdb36c6f b84b3184b62ea7a5ce0090d7a394fd8531deca86
worktree-agent-a8ee94ff02f276a5f 5b3f6d2a6877937f7382100177b048b43310f101
worktree-agent-a9027065bfaf1e6b3 3ae06805aa11ff0ecb9832f9f779774401e2fdaa
worktree-agent-a9429777f0ce395c1 82489b330d962b1458c65085fe0c4db839e8a307
worktree-agent-a95dcd137cdfaf88a 89e70bff9eb6f4e1275c65db6bb6b4673019d961
worktree-agent-a966279b154fb15d8 d7471173dc8ad7fd52ef94eb5c4cb03077fb8304
worktree-agent-a987eb6cce681ae55 f50b2859c1ea2af3faa1bffb03c8e67f252ddd7f
worktree-agent-a9b532f37032f5f20 6c8da27084d4f5b5d0fa271e02545ea97f687cbf
worktree-agent-a9dd22bdc9d6f9a1f e0f98f66b04a7ea9f542344079ba4a5c95e5912a
worktree-agent-a9f27a406e60111c7 7a71a6ad39c9f558280f109b001bd3eb506a3b9d
worktree-agent-aa1af7530e99ba7f2 b8c46d10175644164a91262810bef402a2b19828
worktree-agent-aa208f246c277d2b9 89e70bff9eb6f4e1275c65db6bb6b4673019d961
worktree-agent-aa421a52dc82726f7 7bf41d6ea0df8833e964e1d3ff7a728bd750d626
worktree-agent-aa4a3483e19590afb efdc51a1c49ee38cab391e68c621c52bf3b974a4
worktree-agent-aa4fc4f5ab6f3b30a 2838fab9d6137de5fde98dcefcd513c4e73ebce9
worktree-agent-aa931207f4fe3c4b6 76c3d37b569d458b86137b626a37da84b4c1cd49
worktree-agent-aab7fe3f60fcb36b9 338f303bda4949a858a2588f5b43abfbdebe27c6
worktree-agent-aaef72067f07045a6 dc8aa3a53d919d0f1aec12ee31b6e0d13b6e6c03
worktree-agent-aafc2078150b0d137 21781a3ebc39d293a04d4318e2bb4c416ec4bd5e
worktree-agent-ab2d7f829abe565b1 2a2ee235056bf20eb54b9969d8c9f5aa467b172e
worktree-agent-ab605115be0e50c24 2fac24f39154e9402c5902aa454da1f459e368d1
worktree-agent-ab8f7bbbb9a6b52d5 5a6664b12d2f14f573ac6018b26c56f8f0dd9f25
worktree-agent-ab963a35e69f3c709 fe3a3e19a222ead5d2f1afcbf2d2c489d89f73e9
worktree-agent-aba34eec8df97edea ee9f806c7155fa4d3f2d29a7709d07aec51a72d6
worktree-agent-abd750dce76006c7d 2bf322a6f4518974c0133098e8b738431672d4b2
worktree-agent-ac08bdcba53fbd780 74501bb2f539a7dbaf1cd86ace937d460d64aeb6
worktree-agent-ac11417e22324b84c c448739599a7f9a83d43f4488bc0239aaff2b577
worktree-agent-ac29fe73c0982a40b 472e735c33ab2cc7db1876ba7346339975bf3827
worktree-agent-ac38a8215266eaf6a 8162aa0eddc3835f03b68523e51e8b22a44c4c5e
worktree-agent-ac7301589f2c532bd d2e4d95bec15f6f106941997f09bdef20733bb04
worktree-agent-ac767b40cd885dc0c 7bf41d6ea0df8833e964e1d3ff7a728bd750d626
worktree-agent-ac861f85dfa799a85 89e70bff9eb6f4e1275c65db6bb6b4673019d961
worktree-agent-ac9b19e2d7d73f8cf 6fa4c3b4e1826e0ea4c93c9c3e9720e6d9c8cb90
worktree-agent-acbb7ef27c948b9d1 e0f98f66b04a7ea9f542344079ba4a5c95e5912a
worktree-agent-acd4cd3e25bf4c461 7bf41d6ea0df8833e964e1d3ff7a728bd750d626
worktree-agent-ad21d13784337b249 89e70bff9eb6f4e1275c65db6bb6b4673019d961
worktree-agent-ad27e14aeea0939bf e7b382f6d27e375022ab1d2ebbb19331cfc9fe1e
worktree-agent-ad360d7795aa241d9 f2d25879c6fbabbdb7aa544503c6e76797e446eb
worktree-agent-ad3f4d51cda749a3d 73483a83736a0abd0c30d665a273ea746d695ed4
worktree-agent-ad629471bf3609631 47361d1704593911b0ecc4589a428a8f8580d9da
worktree-agent-ad8eeef2c5aceb3c2 2f581a94fc6e701a2a91ffc0db6f151ffe21e052
worktree-agent-ad920f5bbd08b9e3a 50ca64c6e2fe7add0cdb0d900d6e5130b45981bb
worktree-agent-ada20602db2c8ce47 b8c46d10175644164a91262810bef402a2b19828
worktree-agent-adb5737aec01e28c1 ee14fe5837062a9be4bbc23de7be31469f17210e
worktree-agent-adc969f4f2692a1f4 bb0b8a818e638a9ecf2ce97103904b90a4d4fe0e
worktree-agent-addd676474df0e806 0a34943cd31a607c5c998e78303e31cf71abad46
worktree-agent-adfb609e7a48770c3 d7471173dc8ad7fd52ef94eb5c4cb03077fb8304
worktree-agent-ae334ac5d6305c562 7d7ee99504dca4218537e811da18cf72d205ec7f
worktree-agent-ae37376b868452e65 e7b7ea121ad068c1b21253d437f8b9a7893b7c59
worktree-agent-ae499eb01df8cb87b 5a59e2e85a5ab83becdd73e50db2d5837f419a55
worktree-agent-aea1b132d606c45d4 0cec97f92a863322314f46300c7ef6248435aedb
worktree-agent-aee5e64e0e516fe20 b84b3184b62ea7a5ce0090d7a394fd8531deca86
worktree-agent-af271969998781f5b 1baf2dbe8a8a2756e64ee09efe6aaffa893fabc2
worktree-agent-af322ebd3a26fb211 0606329850f40a9db2584169e54b6ab46deda983
worktree-agent-af49a42f064450da2 66b1801c387fa7fe8e29641fa4aadbc928965cd6
worktree-agent-aff4c0a1857dbcff2 76c3d37b569d458b86137b626a37da84b4c1cd49
chore/198-insights-preview-redeploy db9e30ecdc935338d93114f27837d13ea745c255
chore/restore-eslint-config b3b93ef12c4d04eb0bd39618d3a5d100c8738e08
dedup-entity-pre-319 5e3eb681bab662a211a6d1341dd685a91a141e7d
docs/174-ga4-baseline 7ae8ffa08a9d9531199c26864df673d2a2815783
docs/ia-audit-177 dccbaf378963f8b71708089b9d825ff235a14626
feat/179-paragraph-summary 64c1098b7b61a0de3a0a480c57308b99391937fd
feat/184-hf-collector 3cd49ac69d197e5133016c64cd340798c24d0a4e
feat/187-raw-mention-name ef458ce977ca23feb4cd8054e8e17d6cb2855736
feat/190-og-exemption be57434485fcb80b93f55c1f9725667cc04a909b
feat/190d-parity c5aef17d00399bc9ea5422927852b389d2c340c0
feat/190e2b1-auth-parity 49202d67b37863297329e60640851a0a75a90e70
feat/190e2b2-authenticated-parity 2c4117e27295abb0c74f83d6aa1d21f791fbf917
feat/198-article-insight-templates 5275a11067296d78ce42006dcdb4ef83ed667237
feat/198-insights-launch-prep 31cb91dbe3967766ed82fc134eb1709e81c3296d
feat/392-crawl-spend-capture 2616ce7f20f33a37ba757ce35433f72ed01eb89c
feat/393-crawl-spend-dashboard 5b03e19a071e5984e0d6d2dd032bd86902f6513e
feat/395-spend-soft-alert 37b75669159f9ad8ca25733d707870b8a969c72b
feat/432-suspect-alias-rulings 69e1f7cb485533cbb5b5f9030010608fa60e1053
feat/95-point-in-time-compare 01b7a088c932947d715dfa4923c12112cd24ad56
feat/d1c-trending-harness-only e338125ce2f554932e00463a53fac1020e436cfa
feat/design-agent-spike-178 bf029c7eec13007f05095209c305793068423dfd
feat/ranking-regen-cron 337d4ddc8942e61e515a374475ddb1d08b32cfd6
feat/terminal-bench-agentic-signal-v7.9 95cb7a991253c8afc0c019606c80d5b3524d4dfd
fix/175-ga4-filter-search-events 99896afef64cfce1c74ced0312a9a513d223941c
fix/197-board-noindex-filter a562beb258f93d1a59337a12e31b1a4db76344ab
fix/197-perplexity-indexable f0f0f05576f491e2321d85babba95bd044477fbf
fix/219-whats-new-recent-origin 78c9dd469c557c710e11234598efa4c2494617c0
fix/226-unauthorized-public-route 6ddeb58a08f71b7919b75b41249eff9071a14009
fix/233-search-term-redaction 5288afac9562772293454f46688a958dbe6c24c7
fix/239-utc-client-dates 6ea1770afb1160ca3fed03dbffdb091f4d88f62b
fix/269-factor-key-lookup-dedup 76bad8783aaa08878d90460ddcff54300f34610a
fix/280-stale-v76-text 8c74e77ce70e7d63f2ca5fdf1e42afe3ef48a06a
fix/414-unlocalized-section-redirect cbfc778aa74bee6d7ad59d2029a0249f756118b8
fix/417-bare-section-redirect 29c767f1cbbc28e9a317e505e3fbcd512fee8115
fix/424-tool-meta-by-kind 0736d40b2fb56acd6c32089d5b69a0176e6b6f52
fix/96-eslint-legacy-config-cascade 5bf401183fa4883255a465eaef8971fc7c768ef1
fix/admin-rankings-cache-path 83d0c6062abe0fb5afeb17034f00ea45b651e9ef
fix/block-ttl-and-status-guard 94ae194b25eb5dd74f89e25a576ae35a6a0b25bb
fix/codex-stale-survivor-text 0e18c53aa3c84ad1cc61cb25b177f7744df58b66
fix/content-correctness-cleanup d11f7f9a8a82cff9b70ba856e86c36a05e7ef0cc
fix/current-route-metric-row-count 420f49611f0ccd30d4bcf4878b2e0bff49459df0
fix/d6e-hide-model-page 0636ebfdecdba895f339229645f33d9791feb482
fix/duplicate-link-sections b81b0c477ab2293de3b6ad2a65ad064f216fddf8
fix/glm-family-licence acd26516cabdb61279e53eb8894465b3630818ff
fix/ingestion-freshness-gate 8a329c07ca1b384561c80d89912b638a0dcaf5dd
fix/ingestion-gap-yield-detection 7bfbfcab58d25e70c84141bb8e80878e2e2b21b2
fix/ingestion-truncated-json-172 46c795a8133feea197c489afa4ce8aabd45f3bcf
fix/issue-104-partial-run-completed-at 095a6f57fc4dae874c9e19056a1e147177f82e94
fix/openrouter-model-id-172 ca7c6b61b923a4d1d9887146a38e2124397aefdf
fix/reenable-skipped-test-suites-76 3524dd69aeb779a02e071d529f432733a18ee7da
fix/reference-link-quality d912e00f2e276f5c79a773e836a32e2b8862331f
fix/regen-script-nodeenv-guard 36b686bc16eeaffe9f85ece6431608f1ca71f45e
fix/t76-trending-history-boundary bfc55ec76c674cf6c1ec89821f039a20b0b78df5
fix/tool-taxonomy-gating-prune d598c054b57b912a0866967b28274e7aa7eda6a7
release/codex-redirect-hold d443337a39d584ebc73fdfc0b996441e472f21c4
test/ranking-algorithm-coverage e1cb8e6515732258e4bf36c36c4af3ff03b27a6a
chore/ci-local-gate b8f40e5334eaefa19cdba12a053235b0de0be701
ci/101-publish-rankings-dispatch a21a491a8bc368404827a787442b5832b5aa8a5f
feat/182-monthly-merge b3db19d75bb153e1dd60f95cac7a4c4ef0cd2a6e
feat/187-catalogue-tool-lookup a03d3a27922cfbfed2757b64bdb2c3c0c34bbca1
feat/190c2-gradient-options 8168cd0291ab8e9c7b4db2e75b06f14583c06832
feat/190e1-public-parity f15c273dc789674bde0741c47679818c908d17cd
feat/190e2a-admin-parity 10f330464284353582402ea0133fda01557b94e2
feat/191-release-d91-308s 4c135767288ecb42623590532184b4b9d01b25f4
feat/195-open-weight-filter bf506368ce2ba9a9e10bb0bfdb742d0170d7eea3
feat/207-search-empty-state 64cfda8fcef708566ebe46c783b3e8663f19b5d6
feat/329-model-list-metric-filter 655ba4c9125ab46975357750363dcf5bb1e5b238
feat/394-provider-balance-check 4e50d54c3d7d872b77d264f451085906373c5d37
feat/54-whats-new-index 0b7efae4a29713cf25c78d793ba60ed3d2125681
feat/95-point-in-time-metrics 9915b7f567dc58f49b3aad55290813f0d41488fc
feat/d90-merge-duplicate-tools b01304ae5aff88471ea79050d7c8a8066906e08f
feat/ga4-events-175 878d4b625cd4c644183ffe9ac1ea017b66f10b88
feat/whats-new-auto-regenerate 22cad3b23de4cd1b34b272ad1588cf6c5690154e
fix/0028-openclaw-guard 431deb706992ae7933db57fcdf8c99a73ba92b6d
fix/231-whats-new-platform-items 8e75747e39ed0f3c380761b5d9c0fbd221f9c266
fix/237-timestamptz 287bc504a120a015fddcc5239a9c9b48c108f943
fix/290-tool-repo-writes f936030257dcd3736800a8ee4a1d3a489c662593
fix/367-provider-auth-blocks c7961f8c5cd84a23a0a796fe82c46313c8e1e4e6
fix/api-news-fail-closed 588f10752ac88ec9f1fe1c4da493deb9b10037d1
fix/auth-routing-hardening c8f98ff5436f3351b3240257e93eacdbbef2acb2
fix/codex-merge-and-metrics 55e74c56bbe9dca1b7b9e1d51e5dbda63e67503a
fix/d6e-models-copy abeaf4b4fecb222ab5ad5a809944c4fd8894e8c9
fix/deploy-ajv-formats-eresolve 13c3cd057b2a35042c6435250894e602867655be
fix/ingestion-billing-errors-fail-run 8f57cb22430b49cab5de6ea0fe207bcab7f33c80
fix/run-row-finalization 869e1f7a2523786f1ad39c29e1462be91e80041a
fix/sitemap-news-articles 3f43ef592bfa6ff143cb23a9e35b32eab4fdd24e
chore/drop-google-api-key a52efca5a18f0f22015c4e0449bf8071d5545b2a
feat/186-per-list-rankings a7b78cca64fac768d37a6db98eb426f99af84caf
feat/198-insights-monthly 66cae7f8777ed9c2d0cd7fbfa691b55fa90670f7
feat/198-insights-rss 60adc6408a0b1eafe35146c25d58561c1a194ea2
feat/198-insights-weekly-slice 3970b180081dc8f9d12d4fed1dbf11271d5ce26c
feat/314-activate-productivity-rows 00ba6fe6d408557a7d78105aeef534bf66b2438f
fix/seo-self-canonical 00fa8fc62916921b33785050f101a68eae1e8b2f
perf/368-edge-cache-public-pages 20dce16bd02e4ce0aaadb293f7f3fb350952cd6e
```
