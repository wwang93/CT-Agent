import NavBar from "@/components/NavBar";
import RoleGate from "@/components/RoleGate";
import InstructorCopilot from "@/components/InstructorCopilot";

export default function InstructorPage() {
  return (
    <main>
      <NavBar title="Instructor Copilot: prompt template design" />
      <div className="container" style={{ padding: "26px 0 36px" }}>
        <RoleGate expected="instructor">
          <InstructorCopilot />
        </RoleGate>
      </div>
    </main>
  );
}
