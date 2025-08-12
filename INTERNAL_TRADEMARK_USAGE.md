# Internal Trademark Usage Guidelines

**This software is derived from the source code for Gumroad, Inc. Helper™ software.**

> **Trademark Notice**: Helper™ is a trademark of Gumroad, Inc. This derivative software is not officially endorsed or distributed by Gumroad, Inc.

## Purpose and Scope

This document provides internal guidelines for proper Helper™ trademark usage by team members, contributors, and community maintainers. These guidelines ensure consistent, compliant trademark usage across all internal and external communications.

## Trademark Basics

### Helper Trademark Portfolio
- **Word Marks**: Helper, HelperAI, Helper Community Edition
- **Logo Marks**: The Helper logo and associated visual elements
- **Owner**: Gumroad, Inc.
- **Status**: Active trademark protection

### Our Legal Position
- We distribute software derived from Helper™ source code
- We have NO trademark rights in Helper marks
- We must comply with Gumroad, Inc. trademark guidelines
- We may face enforcement action for violations

## Mandatory Usage Rules

### First Mention Rule
**ALWAYS use proper trademark notation on first mention:**

#### Correct Examples:
- "The Helper™ software provides AI assistance..."
- "Our fork is derived from Helper™ source code..."
- "This feature integrates with Helper™ APIs..."

#### Incorrect Examples:
- ❌ "The helper software provides..."
- ❌ "Our fork is derived from Helper source code..."
- ❌ "This feature integrates with helper APIs..."

### Subsequent Mentions
After first proper mention, you may use "Helper" without the ™ symbol in the same document.

### Attribution Footer
**ALL documents must include attribution footer:**
```
Helper is a trademark of Gumroad, Inc.
```

## Document-Specific Guidelines

### Technical Documentation

#### API Documentation:
```markdown
# Integration with Helper™

This guide explains how to integrate with Helper™ APIs.

## Helper API Endpoints
- `/api/conversations` - Access Helper conversation data
- `/api/users` - Manage Helper user accounts

Note: These are community-maintained APIs derived from Helper™ software.

---
Helper is a trademark of Gumroad, Inc.
```

#### Configuration Files:
```yaml
# config.yml
app_name: "Helper Community Edition"
description: "Community fork of Helper™ software"
trademark_notice: "Helper is a trademark of Gumroad, Inc."
```

### Marketing Materials

#### Website Content:
```html
<title>Helper Community - Open Source AI Assistant</title>
<meta name="description" content="Community-maintained fork of Helper™ AI software">

<footer>
  <p>Helper is a trademark of Gumroad, Inc.</p>
</footer>
```

#### Blog Posts:
```markdown
# Extending Helper™ with Custom Plugins

Learn how to create plugins for Helper™ software...

[Content here]

---
*Helper is a trademark of Gumroad, Inc. This content is not officially endorsed by Gumroad, Inc.*
```

### Internal Communications

#### Email Templates:
```
Subject: Helper Community Update - [Topic]

Dear Team,

Updates regarding our Helper™ derivative project...

[Content]

Best regards,
[Name]

---
Helper is a trademark of Gumroad, Inc.
```

#### Meeting Notes:
```markdown
# Team Meeting - Helper™ Development
Date: [Date]
Attendees: [List]

## Discussion Topics
1. Helper™ API improvements
2. Community feedback on Helper features
3. Upcoming Helper™ integration work

---
Helper is a trademark of Gumroad, Inc.
```

## Communication Channel Guidelines

### Slack/Discord Usage

#### Channel Names:
- ✅ `#helper-development`
- ✅ `#helper-community`
- ✅ `#helper-support`
- ❌ `#official-helper`
- ❌ `#gumroad-helper`

#### Message Templates:
```
📝 When discussing Helper™:
"Working on the Helper™ integration today. The community fork includes..."

📝 When sharing links:
"Check out this Helper™ feature: [link] (Helper is a trademark of Gumroad, Inc.)"
```

#### Bot/Automation Messages:
```javascript
const trademarkNotice = "Helper is a trademark of Gumroad, Inc.";

function sendHelperUpdate(message) {
    return `${message}\n\n${trademarkNotice}`;
}
```

### Social Media Guidelines

#### Twitter/X Posts:
```
🔧 New features added to our Helper™ community fork! 

Check out: [features]

Helper is a trademark of Gumroad, Inc.

#OpenSource #AI #HelperCommunity
```

#### LinkedIn Updates:
```
We're excited to announce updates to our Helper™-derived software...

[Content]

*Helper is a trademark of Gumroad, Inc. This project is not officially endorsed by Gumroad, Inc.*
```

### GitHub/Repository Usage

#### Repository Description:
```
Community-maintained fork of Helper™ AI software. 
Helper is a trademark of Gumroad, Inc.
```

#### README Template:
```markdown
# Helper Community Edition

A community-maintained fork of Helper™ software.

## About
This project is derived from the source code for Gumroad, Inc. Helper™ software...

[Content]

## Legal Notice
Helper™ is a trademark of Gumroad, Inc. This derivative software is not officially endorsed or distributed by Gumroad, Inc.
```

#### Issue Templates:
```markdown
---
name: Bug Report
about: Report a bug in Helper Community Edition
---

**Bug Description**
A clear description of the bug in our Helper™ derivative...

[Template content]

---
Helper is a trademark of Gumroad, Inc.
```

## Logo and Visual Identity Usage

### Prohibited Logo Usage
**NEVER use Helper logos in:**
- Modified software distributions
- Community website headers
- Social media avatars
- Marketing materials
- Presentation slides
- Merchandise

### Alternative Visual Identity

#### Approved Community Branding:
```
Name: "Helper Community Edition"
Logo: Custom community-designed logo (no Helper elements)
Colors: Distinct color scheme from official Helper
Typography: Different font selection
```

#### File Naming for Assets:
```
✅ helper-community-logo.png
✅ community-banner.jpg  
✅ hce-icon.svg

❌ helper-logo.png
❌ official-helper-banner.jpg
❌ gumroad-helper-icon.svg
```

## Code and Development Guidelines

### Code Comments and Documentation

#### Acceptable Code Comments:
```javascript
// Integration with Helper™ API
function connectToHelper() {
    // This connects to our Helper™ derivative's API
    return fetch('/api/helper-community/');
}

/**
 * Helper™ Data Parser
 * Parses data formats compatible with Helper™ software
 * Helper is a trademark of Gumroad, Inc.
 */
```

#### Database/Variable Naming:
```sql
-- Acceptable table names
CREATE TABLE helper_community_users;
CREATE TABLE hce_conversations;
CREATE TABLE community_helper_data;

-- Avoid these names
CREATE TABLE helper_official_users;    -- ❌
CREATE TABLE gumroad_helper_data;     -- ❌
```

### Configuration and Environment Variables

#### Environment Variable Naming:
```bash
# Acceptable
HELPER_COMMUNITY_API_KEY=xxx
HCE_DATABASE_URL=xxx
COMMUNITY_HELPER_TOKEN=xxx

# Avoid
HELPER_OFFICIAL_KEY=xxx
GUMROAD_HELPER_URL=xxx
```

#### Configuration Comments:
```yaml
# Helper™ Community Configuration
# This configures our Helper™ derivative software
# Helper is a trademark of Gumroad, Inc.

app:
  name: "Helper Community Edition"
  description: "Community fork of Helper™"
```

## External Vendor Communications

### Vendor Outreach Templates

#### Service Provider Communications:
```
Subject: Integration Request - Helper Community Edition

Dear [Vendor],

We're developing a community-maintained fork of Helper™ software and would like to integrate with your service.

About our project:
- Community-maintained derivative of Helper™ software
- Not officially affiliated with or endorsed by Gumroad, Inc.
- Open source project with [X] contributors

Helper™ is a trademark of Gumroad, Inc.

Best regards,
[Name]
```

#### Partnership Inquiries:
```
We maintain a community fork derived from Helper™ software (Helper is a trademark of Gumroad, Inc.). We're interested in exploring integration possibilities...

Please note:
- This is a community project, not an official Gumroad, Inc. initiative
- We cannot speak for or represent Gumroad, Inc.
- Any partnership would be with our community organization
```

## Training and Onboarding

### New Team Member Checklist

#### Required Training:
- [ ] Read complete trademark guidelines
- [ ] Review internal usage examples
- [ ] Complete trademark usage quiz
- [ ] Sign acknowledgment of understanding
- [ ] Set up compliant email signature
- [ ] Configure social media profiles appropriately

#### Training Materials:
1. **Trademark Law Basics** (30 minutes)
2. **Helper™ Specific Guidelines** (45 minutes)
3. **Common Violation Examples** (30 minutes)
4. **Internal Usage Practices** (60 minutes)
5. **Q&A Session** (30 minutes)

### Ongoing Education

#### Monthly Reminders:
- Email with common usage examples
- Slack reminders about proper attribution
- Review of recent trademark updates
- Sharing of best practices

#### Quarterly Reviews:
- Assessment of team compliance
- Update training materials
- Address common mistakes
- Review external communications

## Compliance Monitoring

### Self-Assessment Tools

#### Daily Checklist:
- [ ] Used Helper™ on first mention in documents
- [ ] Included trademark attribution where required
- [ ] Avoided unauthorized logo usage
- [ ] Used appropriate disclaimers in external communications

#### Weekly Review:
- [ ] Audit published content for compliance
- [ ] Review social media posts
- [ ] Check repository documentation
- [ ] Verify email signatures current

### Automated Monitoring

#### Content Scanning:
```python
import re

def check_trademark_compliance(text):
    """Check for proper Helper trademark usage"""
    
    # Check for first mention with ™
    helper_mentions = re.findall(r'\bhelper\b', text, re.IGNORECASE)
    first_mention = re.search(r'\bHelper™\b', text)
    
    if helper_mentions and not first_mention:
        return "Missing Helper™ on first mention"
    
    # Check for attribution footer
    attribution = "Helper is a trademark of Gumroad, Inc."
    if helper_mentions and attribution not in text:
        return "Missing trademark attribution"
    
    return "Compliant"
```

#### Repository Hooks:
```bash
#!/bin/bash
# Pre-commit hook for trademark compliance

echo "Checking trademark compliance..."

# Check for required attribution in markdown files
grep -r "Helper is a trademark of Gumroad, Inc." *.md > /dev/null
if [ $? -ne 0 ]; then
    echo "Error: Missing trademark attribution in documentation"
    exit 1
fi

echo "Trademark compliance check passed"
```

## Violation Response

### Internal Violation Types

#### Minor Violations:
- Missing ™ symbol on first mention
- Missing attribution footer
- Informal communication oversights

**Response**: Private reminder and education

#### Major Violations:
- Using Helper logos without permission
- Claiming official endorsement
- Creating misleading materials

**Response**: Immediate correction required, formal training

#### Serious Violations:
- Trademark infringement
- Deliberate misrepresentation
- Legal risk creation

**Response**: Escalation to legal counsel, potential disciplinary action

### Correction Procedures

#### For Documentation:
1. **Immediate Edit**: Fix the document immediately
2. **History Update**: Update version control with compliant version
3. **Distribution**: Redistribute corrected version
4. **Learning**: Review with team member for education

#### For Published Content:
1. **Takedown**: Remove non-compliant content
2. **Correction**: Create compliant replacement
3. **Republish**: Post corrected version
4. **Notification**: Inform relevant stakeholders

## Emergency Procedures

### Cease and Desist Response

#### Immediate Actions (Within 24 Hours):
1. **Stop**: Halt all potentially infringing activities
2. **Assess**: Review the specific claims made
3. **Document**: Preserve all relevant communications
4. **Contact**: Reach out to legal counsel
5. **Respond**: Acknowledge receipt and compliance intent

#### Investigation Process:
1. **Review**: Examine our usage practices
2. **Compare**: Check against official guidelines
3. **Correct**: Implement necessary changes
4. **Verify**: Confirm compliance with legal counsel
5. **Respond**: Provide formal response to Gumroad, Inc.

### Legal Consultation Triggers

**Immediate Consultation Required For:**
- Trademark enforcement communication
- Unclear usage scenarios
- Commercial partnership discussions
- International distribution questions
- Media interview requests about Helper

## Tools and Resources

### Compliance Tools

#### Browser Bookmarks:
- Official Helper Trademark Guidelines
- Model Trademark Guidelines
- USPTO Trademark Database
- Legal Consultation Contacts

#### Reference Documents:
- Trademark Usage Quick Reference Card
- Common Mistakes Guide
- Approved Language Templates
- Legal Contact Information

### Templates and Forms

#### Document Templates:
- Email signature with attribution
- Blog post template with disclaimers
- Press release template
- Social media post templates

#### Forms:
- Trademark Compliance Acknowledgment
- Violation Report Form
- Legal Consultation Request
- Training Completion Certificate

## Contact Information

### Internal Contacts:
- **Compliance Officer**: compliance@helper-community.org
- **Legal Counsel**: legal@helper-community.org
- **Community Manager**: community@helper-community.org

### External Contacts:
- **Gumroad Legal**: [Contact information]
- **Trademark Attorney**: [Contact information]
- **IP Consultation**: [Contact information]

### Emergency Contacts:
- **After Hours Legal**: +1-XXX-XXX-XXXX
- **Compliance Hotline**: compliance-urgent@helper-community.org

---

**Document Version**: 1.0  
**Last Updated**: August 12, 2025  
**Review Schedule**: Monthly  
**Next Review**: September 12, 2025  

**Trademark Notice**: Helper is a trademark of Gumroad, Inc.