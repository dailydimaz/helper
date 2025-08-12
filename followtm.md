# Trademark Compliance Tasks - Helper AI Lightweight Migration

Following trademark_guidelines.md requirements in context of the Supabase to PostgreSQL/Drizzle ORM migration.

## Task 1: Code Distribution Compliance Review
**Priority:** HIGH  
**Subagent:** legal-compliance-checker  
**Estimated Time:** 2-3 hours

**Claude Code Prompt:**
```
Review the lightweight Helper AI application for trademark compliance following trademark_guidelines.md requirements after migration from Supabase to PostgreSQL/Drizzle ORM.

Since we've created a lightweight version by migrating from Supabase to PostgreSQL, I need to ensure proper trademark compliance for code distribution:

1. **Modified Code Assessment**: 
   - Determine if the migration constitutes "modified code" under trademark guidelines
   - The codebase has been significantly modified (removed Supabase, added JWT auth, changed database layer, replaced tRPC with SWR)
   - Review sections 38-40 of trademark_guidelines.md for modified code requirements

2. **Logo and Branding Review**:
   - Verify all Gumroad Inc./Helper logos are properly handled according to guidelines
   - Check if any logos need removal per modified code requirements
   - Review helper.ai logo usage in the lightweight version

3. **Word Mark Usage**:
   - Ensure proper use of "Helper", "HelperAI", "Helper Community Edition" word marks
   - Verify truthful description requirements are met
   - Add required trademark attribution: "Helper is a trademark of Gumroad, Inc."

4. **Distribution Compliance**:
   - Review if lightweight version can be distributed as "Helper software"
   - Ensure clear identification as derived/modified version if required
   - Check compliance with sections 18-24 of trademark guidelines

Files to examine:
- /Users/dmzmzmd/helper/README.md
- /Users/dmzmzmd/helper/package.json  
- Any logo/branding assets in /public/ or /assets/
- About/footer components showing branding
- Documentation files mentioning Helper/HelperAI
```

## Task 2: Documentation and Attribution Updates
**Priority:** HIGH  
**Subagent:** legal-compliance-checker  
**Estimated Time:** 1-2 hours

**Claude Code Prompt:**
```
Update documentation and attribution to comply with trademark_guidelines.md requirements for the lightweight Helper AI version.

Based on trademark guidelines sections 74-78 and 94, ensure proper trademark marking:

1. **Trademark Attribution Requirements**:
   - Add "Helper is a trademark of Gumroad, Inc." to appropriate locations
   - Use proper trademark symbols (®/™) for first/prominent mentions
   - Follow sections 74-78 for proper trademark marking

2. **Documentation Updates**:
   - Update README.md with proper trademark attribution
   - Review migration documentation for trademark compliance
   - Ensure derivative work is properly identified if required

3. **Modified Software Identification**:
   - If migration constitutes modified software, properly identify as derived
   - Use acceptable language: "This software is derived from the source code for Gumroad, Inc. Helper software"
   - Remove any misleading references that suggest official distribution

4. **Footer/About Components**:
   - Add trademark notices to application footer
   - Ensure proper attribution in about pages/modals
   - Follow section 78 for foot-of-page trademark notices

Files to update:
- /Users/dmzmzmd/helper/README.md
- /Users/dmzmzmd/helper/DEPLOYMENT.md  
- /Users/dmzmzmd/helper/MIGRATION.md
- Footer components and about pages
- Package.json description fields
```

## Task 3: Domain and Service Name Compliance
**Priority:** MEDIUM  
**Subagent:** legal-compliance-checker  
**Estimated Time:** 1 hour

**Claude Code Prompt:**
```
Verify domain names and service configurations comply with trademark guidelines sections 54-68 regarding managed services and domain restrictions.

Review trademark compliance for deployment and service naming:

1. **Domain Name Compliance** (Section 66-68):
   - Verify no domain names include Helper word marks or variants
   - Check deployment configurations don't use restricted domains
   - Review any subdomain or service naming conventions

2. **Managed Service Restrictions** (Section 52-54):
   - Ensure lightweight version isn't offered as hosted service using Helper marks
   - If offering managed services, verify compliance with licensing requirements
   - Use own service marks if providing hosted Helper software

3. **Service Description Compliance**:
   - Verify service descriptions only state "built using Helper software"
   - Don't use Helper logos for hosted services without license
   - Follow acceptable compatibility statements

4. **Configuration Files Review**:
   - Check docker configurations and deployment scripts
   - Review any service naming in infrastructure files
   - Ensure no trademark violations in deployment naming

Files to check:
- Docker configurations and deployment scripts
- Environment variable naming
- Service discovery and naming configurations
- Any hosted service documentation
```

## Task 4: Community and Distribution Guidelines
**Priority:** LOW  
**Subagent:** legal-compliance-checker  
**Estimated Time:** 1 hour

**Claude Code Prompt:**
```
Ensure community interaction and distribution plans comply with trademark guidelines sections for user groups and distribution.

Review compliance for community engagement and distribution:

1. **User Group Compliance** (Section 56-64):
   - If creating user groups, ensure compliance with section requirements
   - Verify group focus is on Helper software
   - Ensure non-profit nature and proper cost coverage

2. **Distribution Channel Compliance**:
   - Review planned distribution methods
   - Ensure proper trademark marking for any distribution
   - Verify compatibility statements are accurate

3. **Community Guidelines**:
   - Create internal guidelines for trademark usage in community interactions
   - Ensure team understands proper Helper trademark usage
   - Document acceptable ways to reference the software

4. **Future Planning**:
   - Document trademark considerations for future features
   - Plan compliance for any commercial aspects
   - Ensure ongoing compliance monitoring

Files to create/update:
- Community interaction guidelines
- Distribution documentation
- Internal trademark usage guidelines
- Compliance monitoring procedures
```

---

## Summary

These tasks ensure the lightweight Helper AI migration maintains proper trademark compliance while transitioning from the Supabase-dependent version to the PostgreSQL/Drizzle ORM architecture.

**Total Estimated Time:** 5-6 hours

**Key Compliance Areas:**
- Modified software identification and attribution
- Proper trademark marking and legends  
- Logo usage compliance for modified code
- Service naming and domain restrictions
- Community interaction guidelines

**Success Criteria:**
- All trademark attributions properly placed
- Modified software status clearly identified if required
- No trademark violations in naming or branding
- Compliance documentation in place
- Team understands ongoing trademark obligations