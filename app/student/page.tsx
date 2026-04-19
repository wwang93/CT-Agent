import NavBar from "@/components/NavBar";
import RoleGate from "@/components/RoleGate";
import StudentCoach from "@/components/StudentCoach";

export default function StudentPage() {
  return (
    <main>
      <NavBar title="Student Coach: evidence-focused Socratic dialogue" />
      <div className="container" style={{ padding: "26px 0 36px" }}>
        <RoleGate expected="student">
          <StudentCoach />
        </RoleGate>
      </div>
    </main>
  );
}
