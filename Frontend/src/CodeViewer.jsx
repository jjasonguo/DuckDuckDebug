import React, { useEffect, useRef } from "react";
import hljs from "highlight.js";

const CodeViewer = ({ content, activeTab }) => {
  const codeRef = useRef(null);

  useEffect(() => {
    console.log("Re-highlighting", { activeTab, content });

    if (codeRef.current) {
      codeRef.current.removeAttribute("data-highlighted");
      hljs.highlightElement(codeRef.current);
    }
  }, [content, activeTab]);

  const language = activeTab === "uml" ? "plaintext" : "python";

  return (
    <div className="content-box" id="tab-content">
      <pre className="code-wrapper">
        <code ref={codeRef} className={`language-${language}`}>
          {content[activeTab]}
        </code>{" "}
      </pre>
    </div>
  );
};

export default CodeViewer;
