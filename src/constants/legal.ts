// RoadLedger Legal Documents
// Terms of Service and Privacy Policy
// Cien Rios LLC

export const LEGAL_VERSION = '1.0.0';
export const LEGAL_EFFECTIVE_DATE = 'January 14, 2026';
export const LEGAL_LAST_UPDATED = 'January 14, 2026';

export const COMPANY_INFO = {
  name: 'Cien Rios LLC',
  dba: 'RoadLedger',
  address: '17113 Miramar Parkway',
  city: 'Miramar',
  state: 'FL',
  zip: '33027',
  country: 'United States',
  phone: '(754) 254-7141',
  email: 'support@cienrios.com',
};

export const TERMS_OF_SERVICE = `
RoadLedger Terms of Service

Effective Date: ${LEGAL_EFFECTIVE_DATE}
Last Updated: ${LEGAL_LAST_UPDATED}

These Terms of Service ("Terms") govern your access to and use of the RoadLedger mobile application and related services (the "Service") provided by ${COMPANY_INFO.name} ("Company," "we," "us," or "our").

COMPANY INFORMATION
${COMPANY_INFO.name} (dba ${COMPANY_INFO.dba})
${COMPANY_INFO.address}
${COMPANY_INFO.city}, ${COMPANY_INFO.state} ${COMPANY_INFO.zip}
${COMPANY_INFO.country}
Phone: ${COMPANY_INFO.phone}

By creating an account, downloading, accessing, or using the Service, you agree to these Terms. If you do not agree, do not use the Service.

1. ELIGIBILITY AND ACCOUNT

• You must be at least 18 years old to use the Service.
• You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.
• You agree to provide accurate information and keep it updated.

2. THE SERVICE

RoadLedger helps owner-operators and truck drivers track mileage, trips, expenses, and revenue; store documents such as receipts and settlements; and generate reports/exports. Some features may use automation or AI-assisted extraction to help populate fields.

IMPORTANT: RoadLedger is not a tax, accounting, or legal professional service. You remain responsible for verifying your records and consulting professionals as needed.

3. SUBSCRIPTIONS, FEES, AND BILLING

If the Service offers paid subscriptions or in-app purchases:

• Pricing, plan features, and billing intervals will be shown in-app before purchase.
• Purchases on iOS are processed through Apple's In-App Purchase system. Your Apple account will be charged upon confirmation.
• Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period.
• You can manage or cancel subscriptions in your Apple ID account settings.
• CANCELLATION: You may cancel your subscription at any time with one click through your device's subscription settings. No penalties or fees apply for cancellation.

4. USER CONTENT AND DOCUMENTS

• You may upload documents and information ("User Content") including receipts, settlements, and other files.
• You retain ownership of your User Content.
• You grant us a limited license to host, store, process, and display your User Content solely to provide and improve the Service.
• You represent that you have the rights to upload your User Content and that it does not violate laws or third-party rights.

5. AI-ASSISTED FEATURES AND ACCURACY

• Some features may use AI or automated extraction (e.g., reading a receipt image and suggesting vendor/date/amount).
• AI outputs are suggestions and may be incorrect.
• You are responsible for reviewing and confirming entries before using them for taxes, compliance, or business decisions.

6. ACCEPTABLE USE

You agree not to:

• Use the Service for unlawful purposes.
• Attempt to access another user's account or data.
• Reverse engineer, scrape, disrupt, or interfere with the Service.
• Upload malware or harmful content.

7. DATA EXPORTS AND RECORDKEEPING

Exports and summaries are provided for convenience. You are responsible for:

• verifying accuracy,
• keeping backups if needed, and
• ensuring compliance with any regulatory obligations (including IFTA, tax reporting, and business record retention rules that apply to you).

8. THIRD-PARTY SERVICES

The Service may integrate or interoperate with third-party services (e.g., cloud providers, analytics, OCR, AI providers). Your use of those third-party services may be subject to their terms.

9. TERMINATION

You can stop using the Service at any time. We may suspend or terminate access if you violate these Terms or if required to protect the Service, users, or comply with law.

10. DISCLAIMERS

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

We do not guarantee uninterrupted, secure, or error-free operation. We do not guarantee that AI-assisted or automated extraction will be accurate.

11. LIMITATION OF LIABILITY

TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${COMPANY_INFO.name.toUpperCase()} WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE.

Our total liability for any claim will not exceed the amount you paid (if any) to use the Service in the 12 months before the event giving rise to the claim.

12. INDEMNIFICATION

You agree to defend and indemnify ${COMPANY_INFO.name} from claims arising out of your misuse of the Service or violation of these Terms.

13. CHANGES TO THE SERVICE OR TERMS

We may modify the Service and these Terms from time to time. If changes are material, we will provide notice in the app or by other reasonable means. Continued use after changes means you accept the updated Terms.

14. GOVERNING LAW

These Terms are governed by the laws of the State of Florida, without regard to conflict-of-law principles.

15. ACCESSIBILITY

We are committed to making RoadLedger accessible to all users, including those with disabilities. The app is designed to be compatible with screen readers, supports dynamic text sizing, and provides high-contrast modes. If you encounter accessibility barriers, please contact us at ${COMPANY_INFO.email}.

16. CONTACT

Questions about these Terms: ${COMPANY_INFO.email}
Mail: ${COMPANY_INFO.name}, ${COMPANY_INFO.address}, ${COMPANY_INFO.city}, ${COMPANY_INFO.state} ${COMPANY_INFO.zip}
`;

export const PRIVACY_POLICY = `
RoadLedger Privacy Policy

Effective Date: ${LEGAL_EFFECTIVE_DATE}
Last Updated: ${LEGAL_LAST_UPDATED}

This Privacy Policy explains how ${COMPANY_INFO.name} ("we," "us," "our") collects, uses, shares, and protects information when you use the RoadLedger app and related services (the "Service").

1. INFORMATION WE COLLECT

A) Information you provide

• Account information (e.g., email, name if provided)
• Profile details (e.g., home state, timezone, company name if provided)
• Trip notes, manual mileage/odometer entries
• Documents you upload (receipts, settlements, maintenance documents)
• Support messages you send to us

B) Information collected automatically

• App usage and diagnostics (e.g., crash logs, performance metrics)
• Device and app identifiers (for functionality and security)
• Approximate metadata needed to operate the Service (e.g., timestamps)

C) Location information (with your permission)

If you enable automatic trip tracking, we collect location data to:

• record routes/trips,
• estimate mileage,
• compute jurisdiction/state mileage (where available),
• and generate your reports.

You can disable location tracking at any time in your device settings. Some features may not work without location permissions.

D) Financial/transaction information you enter or upload

RoadLedger may store the amounts, dates, vendors, and categories you enter or that are extracted from documents. We do not collect your bank login credentials unless you explicitly connect a third-party bank-sync provider in the future (and then it would be governed by their flow and permissions).

2. HOW WE USE INFORMATION

We use information to:

• Provide and maintain the Service (trip tracking, reports, exports)
• Store and organize your documents and entries
• Process documents using OCR/AI-assisted extraction (if enabled)
• Improve reliability, performance, and user experience
• Prevent fraud, abuse, and security incidents
• Comply with legal obligations and enforce our Terms

3. AI / OCR PROCESSING

If you use document parsing features:

• We may process receipt/settlement images and PDFs with OCR and AI services to extract structured fields (vendor/date/amount/category).
• We use extracted data to populate your records and show you review screens.
• You control final accuracy: you can edit or reject extracted data before relying on it.
• We design extraction to be "human reviewable" and may label entries as "needs review" if confidence is low.

4. HOW WE SHARE INFORMATION

We do not sell your personal information.

We may share information with:

• Service providers that help operate the app (hosting, storage, database, monitoring, OCR/AI processing), only as needed to provide the Service
• Legal or safety reasons, if required by law or to protect rights, safety, and security
• Business transfers, if we are involved in a merger, acquisition, or sale (you'll be notified as required)

5. DATA RETENTION

We retain your information as long as needed to:

• provide the Service,
• comply with legal obligations,
• resolve disputes,
• and enforce agreements.

You can request deletion (see "Delete My Data").

6. SECURITY

We use reasonable administrative, technical, and physical safeguards designed to protect your data, including:

• End-to-end encryption for data in transit
• Encrypted storage for sensitive data at rest
• Access controls and authentication
• Regular security audits
• Admin access logging with IP addresses and timestamps

No system can be guaranteed 100% secure.

7. YOUR CHOICES AND RIGHTS

Depending on your location, you may have rights to:

• access, correct, or delete your data,
• export your data (where available),
• withdraw consent for location tracking.

You can update many settings in-app (or via device settings for location).

California residents have additional rights under CCPA.
EU/UK residents have additional rights under GDPR.

8. DELETE MY DATA

You can request deletion of your account and associated personal data:

• In-app: Settings > Privacy > "Delete My Data"
• By email: Send a request to ${COMPANY_INFO.email} with the subject "Delete My Data - RoadLedger" and the email address associated with your account.

We will process deletion requests within 30 days. We may need to retain certain records if required by law or for legitimate business purposes (e.g., security logs, dispute resolution), but we will minimize retained data.

9. CHILDREN'S PRIVACY

RoadLedger is not intended for children under 13 (or 16 in the EU). We do not knowingly collect personal information from children. If we learn we have collected information from a child, we will delete it promptly.

10. INTERNATIONAL DATA TRANSFERS

Your data may be processed in the United States. By using the Service, you consent to this transfer. We take steps to ensure appropriate safeguards are in place.

11. COOKIES AND TRACKING

The mobile app does not use cookies. We may use analytics tools to understand app usage and improve the Service. You can opt out of analytics in app settings.

12. CHANGES TO THIS POLICY

We may update this Privacy Policy from time to time. If changes are material, we will provide notice in the app. Continued use after changes means you accept the updated policy.

13. CONTACT

Privacy questions: ${COMPANY_INFO.email}
Mail: ${COMPANY_INFO.name}, ${COMPANY_INFO.address}, ${COMPANY_INFO.city}, ${COMPANY_INFO.state} ${COMPANY_INFO.zip}
Phone: ${COMPANY_INFO.phone}

14. DATA PROTECTION OFFICER

For privacy-related inquiries, contact our Data Protection Officer at: privacy@cienrios.com
`;

export const CONSENT_TYPES = {
  TERMS_OF_SERVICE: 'terms_of_service',
  PRIVACY_POLICY: 'privacy_policy',
  LOCATION_TRACKING: 'location_tracking',
  MARKETING: 'marketing',
  ANALYTICS: 'analytics',
} as const;

export type ConsentType = typeof CONSENT_TYPES[keyof typeof CONSENT_TYPES];
