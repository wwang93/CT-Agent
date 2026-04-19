import NavBar from "@/components/NavBar";
import RoleGate from "@/components/RoleGate";
import ResearchAnalytics from "@/components/ResearchAnalytics";

export default function ResearchPage() {
  return (
    <main>
      <NavBar title="Research Analytics: implementation evidence" />
      <div className="container" style={{ padding: "26px 0 36px" }}>
        <RoleGate expected="researcher">
          <ResearchAnalytics />
        </RoleGate>
      </div>
    </main>
  );
}
