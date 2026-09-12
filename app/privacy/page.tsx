import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `Privacy · ${BRAND.name}`,
  description: `How ${BRAND.name} handles your data.`,
};

// Plain-English privacy policy. The app has no accounts and collects essentially
// nothing: the name you type stays on your device, session inputs are sent to the
// AI providers only to generate that session, and analytics are anonymous and
// aggregate. Update the contact address below if you use a different one.
const CONTACT = BRAND.support;
const UPDATED = "September 12, 2026";

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: "640px",
        margin: "0 auto",
        padding: "60px 24px 96px",
        lineHeight: 1.6,
      }}
    >
      <p
        style={{
          fontSize: "12px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.55,
          margin: "0 0 10px",
        }}
      >
        {BRAND.name}
      </p>
      <h1 style={{ fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
        Privacy Policy
      </h1>
      <p style={{ opacity: 0.6, margin: "0 0 34px", fontSize: "14px" }}>Last updated: {UPDATED}</p>

      <p>
        {BRAND.name} is a personalized mindfulness app. It writes and voices a
        guided session for you in the moment. We built it to be private by
        default: there are no accounts, and we collect essentially nothing about
        you. This page explains exactly what that means.
      </p>

      <Section title="What we collect">
        <ul style={{ paddingLeft: "20px", margin: "0" }}>
          <li style={{ marginBottom: "10px" }}>
            <b>The name you enter</b> is stored <b>only on your device</b> (in your
            browser&rsquo;s local storage) so we can address you during a session.
            It is not sent to us as an account and never leaves your device except
            as part of the words of the session you request.
          </li>
          <li style={{ marginBottom: "10px" }}>
            <b>Session inputs.</b> The intention, length, voice and soundscape you
            choose, and (for a &ldquo;Make Your Own&rdquo; session) the short
            phrase you type, are sent to our processors to generate that one
            session. They are not tied to your identity and are not used to build
            a profile of you.
          </li>
          <li>
            <b>Anonymous usage analytics.</b> We use privacy-friendly, aggregate
            analytics to count page views and understand roughly how the app is
            used. There are no advertising identifiers and no cross-site or
            cross-app tracking.
          </li>
        </ul>
      </Section>

      <Section title="What we don't do">
        <ul style={{ paddingLeft: "20px", margin: 0 }}>
          <li style={{ marginBottom: "8px" }}>No user accounts, logins, or passwords.</li>
          <li style={{ marginBottom: "8px" }}>No selling or renting of your data.</li>
          <li style={{ marginBottom: "8px" }}>No advertising networks and no ad tracking.</li>
          <li>No tracking of you across other apps or websites.</li>
        </ul>
      </Section>

      <Section title="Service providers">
        <p style={{ margin: "0 0 10px" }}>
          To create a session we rely on a few processors, who handle your inputs
          only to deliver the result and under their own terms:
        </p>
        <ul style={{ paddingLeft: "20px", margin: 0 }}>
          <li style={{ marginBottom: "8px" }}>
            <b>Anthropic</b> generates the words of your session from your chosen
            intention and phrase.
          </li>
          <li style={{ marginBottom: "8px" }}>
            <b>ElevenLabs</b> turns those words into the spoken voice.
          </li>
          <li>
            <b>Vercel</b> hosts the app and provides the anonymous, aggregate
            analytics.
          </li>
        </ul>
      </Section>

      <Section title="Data retention">
        <p style={{ margin: 0 }}>
          The name you enter, and your session history and preferences, stay on
          your device until you clear them (or clear your browser data). We do not
          maintain accounts or user profiles, so there is no stored history of your
          sessions tied to you. Session inputs are processed by our providers only
          to generate that one session and are not retained by us.
        </p>
      </Section>

      <Section title="International transfers">
        <p style={{ margin: 0 }}>
          Our providers (Anthropic, ElevenLabs, Vercel) are based in the United
          States, so if you use a &ldquo;Make Your Own&rdquo; session the short
          phrase you type is processed in the US to generate that session. These
          providers process it under their own terms and standard contractual
          protections. If you would rather nothing leave the device, use the preset
          intentions or a sounds-only session, which do not send a phrase.
        </p>
      </Section>

      <Section title="Your rights (EU/UK and others)">
        <p style={{ margin: "0 0 10px" }}>
          Because there are no accounts, most of your data lives on your device and
          is under your direct control: you can view, change, or erase it at any
          time by editing your details in the app or clearing the app&rsquo;s
          storage. Where applicable law (such as the EU/UK GDPR) gives you rights to
          access, correct, delete, or object to the processing of personal data, you
          may exercise them by contacting us. The legal basis for the limited
          processing we do (generating the session you ask for) is performing the
          service you request; analytics rely on our legitimate interest in
          understanding aggregate, non-identifying usage.
        </p>
        <p style={{ margin: 0 }}>
          If you are in the EU/UK you also have the right to lodge a complaint with
          your local data protection authority.
        </p>
      </Section>

      <Section title="Children">
        <p style={{ margin: 0 }}>
          {BRAND.name} is not directed to children under 13 (or the minimum age
          required in your country, such as 16 in parts of the EU), and we do not
          knowingly collect personal information from them.
        </p>
      </Section>

      <Section title="Changes">
        <p style={{ margin: 0 }}>
          We may update this policy from time to time. When we do, we&rsquo;ll
          revise the &ldquo;last updated&rdquo; date above.
        </p>
      </Section>

      <Section title="Contact">
        <p style={{ margin: 0 }}>
          Questions about your privacy? Email{" "}
          <a href={`mailto:${CONTACT}`} style={{ color: "inherit" }}>
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: "30px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 10px" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
