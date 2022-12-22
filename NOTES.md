## NOTES
* Use v2 instructions and acccounts
* Create multisig with config_authority set to authority index 0 as default
* No drafts
* Roles baked in
* Code reuse - MsAuthRealloc should BE MsAuth (since config_authority will pay/sign in all cases)
* Reuse change threshold function for add/remove w/change threshold
  
## Other items - not immediate
* TIME LOCK / DELAY
* (MAYBE?) Granular/dynamic threshold (may have to add a config item to Ms account)
* (MAYBE?)instruction to delete executed txs (approved by ms)
