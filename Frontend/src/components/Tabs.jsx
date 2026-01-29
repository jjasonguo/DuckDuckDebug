import React from "react";

const Tabs = ({ activeTab, onTabClick, fileUploader }) => {
  return (
    <div className="tabs">
      <div
        className={`tab ${activeTab === "code" ? "active" : ""}`}
        onClick={() => onTabClick("code")}
      >
        CODE
      </div>
      <div
        className={`tab ${activeTab === "uml" ? "active" : ""}`}
        onClick={() => onTabClick("uml")}
      >
        UML
      </div>
      <div className="file-upload-area">{fileUploader}</div>
    </div>
  );
};

export default Tabs;
