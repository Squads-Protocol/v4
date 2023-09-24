## Security Policy & Bug Bounty
Learn more about Squads perpetual bug bounty program
1. Reporting security problems 
2. Incident response process
3. Security bug bounties 
### Reporting security problems
DO NOT CREATE AN ISSUE to report a security problem. Instead, please send an email to security@sqds.io and provide your GitHub username so we can add you to a new draft security advisory for further discussion. 
For security reasons, we do not accept vulnerability disclosures presently via email, nor do we accept attachments when provided via email for vulnerability disclosures. 
We suggest that you ensure that multi-factor authentication is enabled on your account prior to submitting.
### Incident response process
In case an incident is discovered or reported, the following process will be followed to contain, respond and remediate:
1. Establish a new draft security advisory
In response to an email to security@sqds.so, a member of the Squads team will: 
* create a new draft security advisory for the incident at  
* add the reporter's Github user and the squads-protocol/security-incident-response-team group to the draft security advisory 
* create a private fork of the repository (grey button towards the bottom of the page) 
* respond to the reporter by email, sharing a link to the draft security advisory. 
If the advisory is the result of an audit finding, a similar but slightly modified process is followed:
follow the same process as above but add the auditor's GitHub username and begin the title with "[Audit]".
2. Triage
Within the draft security advisory, the Squads protocol team and the reporter will discuss and determine the severity of the issue. The Squads Protocol team will ultimately be the determining party for any aspects related to the severity of the issue (and any associated bounty). 
If necessary, members of the squads-protocol/security-incident-response-team group may add other GitHub users to the advisory to assist with triage. 
In the event of a non-critical advisory, the Squads team will work to communicate as broadly where possible with relevant stakeholders and interested parties.
3. Prepare fixes
For the affected branches prepare a fix for the issue and push them to the corresponding branch in the private repository associated with the draft security advisory. 
Normal CI procedures will not be present within the private repository so you must build from source and manually verify fixes. 
Code review from the reporter is ideal, as well as from multiple members of the Squads development team.
4. Ship the patch 
Once the fix is accepted, a member of the squads-protocol/security-incident-response-team group should prepare a single patch file for each affected branch. 
The commit title for the patch should only contain the advisory id, and not disclose any further details about the incident.
5. Public disclosure and release
Once the fix has been deployed, the patches from the security advisory may be merged into the main source repository. At this time, more broad public disclosure may occur via the official Squads Twitter account and other official mediums of communication. 
A new official release for each affected branch should be shipped and upgraded to as quickly as possible.
6. Security advisory bounty accounting and cleanup
If this issue is eligible for a bounty, prefix the title of the security advisory with one of the following, depending on the severity: 
* being able to steal funds 
* being able to freeze funds or render them inaccessible by their owners
* being able to perform replay attacks on the same chain 
* being able to change Squad settings or module settings without consent of owners 
Confirm with the reporter that they agree with the severity assessment, and discuss as required to reach a conclusion.
### Security bug bounties
We offer bounties for critical security issues. Please see below for more details. Either a demonstration or a valid bug report is all that's necessary to submit a bug bounty. 
A patch to fix the issue isn't required.
#### Ability to Steal Funds
$300,000 USD in locked SOL tokens (locked for 12 months)
* theft of funds without users signature from any account 
* theft of funds without users interaction with the Multisig program 
* theft of funds that requires users signature - creating a Multisig program that drains funds.
#### Loss of Availability / Ability to Freeze Funds
$200,000 USD in locked SOL tokens (locked for 12 months): 
* Ability to freeze a User’s ability to claim funds from a Multisig
#### Replay Attacks 
$25,000 USD in locked SOL tokens (locked for 12 months): 
* Ability to replay a previously executed transaction involving a Squads Multisig 
#### Settings Modifications
$10,000 USD in locked SOL tokens (locked for 12 months): 
* Modification of any Multisig or module settings without proper authorization by the owners of the Multisig
### In Scope
Squads V3 on-chain program () is in scope for the bounty program.
### Out of Scope
The following components are out of scope for the bounty program: 
* any encrypted credentials, auth tokens, etc. checked into the repo 
* bugs in dependencies, please take them upstream! 
* attacks that require social engineering 
* any files, modules or libraries other than the ones mentioned above 
* any points listed as an already known weaknesses 
* any points listed in the audit reports 
* any points fixed in a newer version.
### Eligibility
The participant submitting the bug report shall follow the process outlined within this document. 
Multiple submissions for the same class of exploit are still eligible for compensation, though may be compensated at a lower rate, however these will be assessed on a case-by-case basis. 
Participants located in OFAC sanctioned countries may not participate in the bug bounty program at this time.
Duplicate reports
Compensation for duplicative reports will be split among reporters with first to report taking priority using the following equation:\
`R: total reports `\
`ri: report priority`\ 
`bi: bounty share`\
`bi = 2 ^ (R - ri) / ((2^R) - 1)`
### Payment of Bug Bounties
Bounties are paid out NET and are reviewed on a rolling basis. We try to respond to every submission within 24 hours, but some may take longer as we assess relevance and impact.
Responsible Disclosure Policy 
If you comply with the policies below when reporting a security issue to us, we will not undergo legal action or a law enforcement investigation against you in response to your report.
We ask that: 
* You give us reasonable time to investigate and mitigate an issue you report before making public any information about the report or sharing such information with others. 
* You make a good faith effort to avoid security violations and disruptions to others, including (but not limited to) destruction of data and interruption or degradation of our services. 
* You do not exploit a security issue you discover for any reason. This includes demonstrating additional risk, such as an attempted compromise of sensitive company data or probing for additional issues. 
* You have not violated any other applicable laws or regulations. 
* You are not currently subject to any U.S. sanctions administered by the Office of Foreign Assets Control of the U.S. Department of the Treasury (“OFAC”).
