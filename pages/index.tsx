import { useState } from "react";
import ReactMarkdown from "react-markdown";

function stripReferences(md: string) {
  // Remove trailing "References:" section (markdown or plain text)
  return md.replace(/(\*\*?References:?\*\*?|References:)[\s\S]*$/i, "").trim();
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [references, setReferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function askAgent(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAnswer("");
    setReferences([]);
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setAnswer(data.answer);
      setReferences(data.references || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch answer.");
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(120deg, #f3fdfa 0%, #e8f9f1 80%, #f7faff 100%)",
        fontFamily: "Inter, Segoe UI, Arial, sans-serif",
        paddingBottom: 48,
      }}
    >
      <header
        style={{
          textAlign: "center",
          paddingTop: 56,
          paddingBottom: 16,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            background: "white",
            borderRadius: 48,
            padding: "14px 38px 14px 26px",
            boxShadow: "0 3px 32px 0 #7ef3c822, 0 1.5px 12px #24a08e18",
            fontWeight: 900,
            fontSize: "2.7rem",
            color: "#18c194",
            letterSpacing: -1,
          }}
        >
          <span role="img" aria-label="flask" style={{ fontSize: "2.7rem" }}>
            🧪
          </span>
          <span>
            Aspartame <span style={{ color: "#18725d" }}>AI</span>
          </span>
        </div>
        <div style={{
          marginTop: 15,
          fontSize: "1.13rem",
          color: "#1a3d34",
          fontWeight: 600,
          opacity: 0.75,
          letterSpacing: 0.02,
        }}>
          Your research copilot for <span style={{ color: "#18c194" }}>evidence-based health & nutrition</span>.
        </div>
      </header>
      <main style={{ maxWidth: 580, margin: "0 auto" }}>
        <form
          onSubmit={askAgent}
          style={{
            margin: "50px auto 0 auto",
            display: "flex",
            gap: 0,
            maxWidth: 620,
            background: "#fff",
            borderRadius: 24,
            boxShadow: "0 2.5px 22px 2px #24a08e11",
            overflow: "hidden",
            alignItems: "center",
            border: "2px solid #cdf5ea",
            transition: "box-shadow 0.22s",
          }}
        >
          <input
            type="text"
            placeholder="Ask anything health or nutrition..."
            value={question}
            onChange={e => setQuestion(e.target.value)}
            required
            disabled={loading}
            style={{
              flex: 1,
              padding: "23px 29px",
              fontSize: "1.15rem",
              border: "none",
              outline: "none",
              background: "none",
              color: "#063f2e",
              fontWeight: 500,
              letterSpacing: 0.1,
              fontFamily: "inherit",
            }}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "#cdf5ea" : "#18c194",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              fontSize: "1.1rem",
              padding: "16px 36px",
              borderRadius: 16,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 0 0 2px #18c19411",
              transition: "background .13s",
              marginRight: 8,
            }}
          >
            {loading ? "Thinking..." : "Ask"}
          </button>
        </form>

        {error && (
          <div
            style={{
              color: "#c21231",
              background: "#ffe8ea",
              margin: "28px 0 0 0",
              borderRadius: 13,
              padding: "17px 24px",
              boxShadow: "0 1px 8px 1px #0001",
              fontWeight: 500,
              fontSize: "1.07rem",
              letterSpacing: 0.03,
            }}
          >
            {error}
          </div>
        )}

        {answer && (
          <div
            style={{
              margin: "40px 0 0 0",
              padding: "38px 30px 28px 30px",
              background: "#fff",
              borderRadius: 30,
              boxShadow: "0 6px 48px 0 #1fcfa517, 0 1.5px 12px #24a08e12",
              textAlign: "left",
              fontSize: "1.16rem",
              animation: "fadeIn 0.8s",
              minHeight: 180,
              position: "relative"
            }}
          >
            <ReactMarkdown
              children={stripReferences(answer)}
              components={{
                h1: ({node, ...props}) => (
                  <h2 style={{
                    fontSize:"1.32rem",
                    marginTop:28,
                    marginBottom:10,
                    color:"#18c194",
                    fontWeight:900,
                    letterSpacing:0.02,
                    fontFamily:"inherit"
                  }} {...props} />
                ),
                h2: ({node, ...props}) => (
                  <h3 style={{
                    fontSize:"1.17rem",
                    marginTop:18,
                    marginBottom:8,
                    color:"#159a77",
                    fontWeight:700,
                    fontFamily:"inherit"
                  }} {...props} />
                ),
                h3: ({node, ...props}) => (
                  <h4 style={{
                    fontSize:"1.12rem",
                    marginTop:16,
                    marginBottom:7,
                    color:"#118859",
                    fontWeight:700,
                    fontFamily:"inherit"
                  }} {...props} />
                ),
                strong: ({node, ...props}) => (
                  <strong style={{
                    color:"#18725d",
                    fontWeight:700,
                    fontFamily:"inherit"
                  }} {...props} />
                ),
                ul: ({node, ...props}) => (
                  <ul style={{
                    marginLeft:22,
                    marginBottom:15,
                    fontSize: "1.13rem",
                    fontFamily:"inherit"
                  }} {...props} />
                ),
                li: ({node, ...props}) => (
                  <li style={{
                    marginBottom:8,
                    lineHeight:1.7,
                    fontSize:"1.13rem",
                    fontFamily:"inherit"
                  }} {...props} />
                ),
                p: ({node, ...props}) => (
                  <p style={{
                    fontSize:"1.13rem",
                    fontFamily:"inherit",
                    lineHeight:1.7,
                    marginBottom:9,
                  }} {...props} />
                ),
                a: ({node, ...props}) => (
                  <a style={{
                    color:"#18c194",
                    textDecoration:"underline",
                    fontWeight: 600
                  }} {...props} />
                ),
                blockquote: ({node, ...props}) => (
                  <blockquote style={{
                    borderLeft: "4px solid #18c194",
                    paddingLeft: 16,
                    color: "#118859",
                    margin: "12px 0",
                    fontStyle: "italic",
                    background: "#f7fdfa",
                    fontFamily:"inherit"
                  }} {...props} />
                )
              }}
            />

            {references.length > 0 && (
              <div style={{
                marginTop: 32,
                fontSize: "1.07rem",
                background: "#f7fdfa",
                borderRadius: 13,
                padding: 21,
                boxShadow:"0 1px 10px #18c19418"
              }}>
                <div style={{ fontWeight: "bold", marginBottom: 10, color: "#18c194", fontSize: "1.13em", letterSpacing: 0.1 }}>
                  References
                </div>
                <ol style={{paddingLeft:22, marginBottom:0}}>
                  {references.map((ref, idx) =>
                    <li key={idx} style={{marginBottom:10, lineHeight:1.5}}>
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#18725d",
                          fontWeight: 600,
                          textDecoration: "underline"
                        }}
                      >
                        {ref.title || ref.url}
                      </a>
                    </li>
                  )}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Sample Prompts when nothing is loaded */}
        {!answer && !loading && !error && (
          <div style={{
            margin: "54px auto 0 auto",
            color: "#159a77",
            textAlign: "center",
            fontSize: "1.08rem",
            background: "#f6fefa",
            borderRadius: 18,
            boxShadow: "0 1px 10px #18c19411",
            maxWidth: 470,
            padding: 28,
          }}>
            <div style={{fontWeight:600, marginBottom:12}}>Try questions like:</div>
            <ul style={{listStyle: "none", padding:0, margin:0}}>
              <li>• <span style={{color:"#18725d"}}>Is creatine safe for long-term use?</span></li>
              <li>• <span style={{color:"#18725d"}}>Does diet soda really have 0 calories?</span></li>
              <li>• <span style={{color:"#18725d"}}>Is oat milk healthy?</span></li>
              <li>• <span style={{color:"#18725d"}}>What does research say about fish oil?</span></li>
            </ul>
          </div>
        )}

        <style jsx>{`
          @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(28px);}
            100% { opacity: 1; transform: none;}
          }
          @media (max-width: 700px) {
            main {
              max-width: 99vw;
              padding: 0 2vw;
            }
            header > div {
              font-size: 2rem !important;
              padding: 11px 22px 11px 12px !important;
            }
            form {
              max-width: 99vw !important;
              flex-direction: column;
              border-radius: 13px !important;
            }
            form input {
              padding: 13px 13px !important;
              font-size: 1rem !important;
            }
            form button {
              padding: 12px 18px !important;
              border-radius: 9px !important;
              margin-top: 7px !important;
            }
            .answerCard {
              padding: 11px 5px !important;
              border-radius: 9px !important;
            }
          }
        `}</style>
      </main>
      <footer style={{
        marginTop: 60,
        textAlign: "center",
        color: "#8aa3a6",
        fontSize: ".99rem",
        letterSpacing: 0.1,
      }}>
        Built with <span style={{color:"#18c194"}}>🧪 Aspartame AI</span> &mdash; Science for everyone.
      </footer>
    </div>
  );
}
