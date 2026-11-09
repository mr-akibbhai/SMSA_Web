import { useEffect, useState } from "react";
import {
  Menu, X, Users, GraduationCap, CalendarDays, ShieldCheck,
  LogIn, LogOut, UserCircle, ArrowRight, Mail, Heart,
  Search, Clock, MapPin, Lock, KeyRound
} from "lucide-react";
import { supabase } from "./lib/supabase";

const navItems = ["Home", "About", "Alumni", "Events", "Committee"];

export default function App() {
  const [page, setPage] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [accountType, setAccountType] = useState(
    () => localStorage.getItem("smsa_account_type") || "member"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [alumni, setAlumni] = useState([]);
  const [events, setEvents] = useState([]);
  const [committee, setCommittee] = useState([]);
  const [pending, setPending] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);

  const [form, setForm] = useState({
    full_name: "",
    passing_year: "",
    batch: "",
    phone: "",
    blood_group: "",
    bio: ""
  });

  // AUTHENTICATION INITIALIZATION
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setMessage("Supabase configuration is missing.");
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);

        if (event === "PASSWORD_RECOVERY") {
          setPage("ResetPassword");
          setLoading(false);
          return;
        }

        // Only the auth listener loads an account after login.
        // This prevents duplicate loadAccount() calls.
        if (
          event === "INITIAL_SESSION" ||
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED"
        ) {
          if (newSession) {
            setTimeout(() => {
              loadAccount(newSession.user.id, newSession.user);
            }, 0);
          } else {
            setLoading(false);
          }
        }

        if (event === "SIGNED_OUT") {
          setSession(null);
          setProfile(null);
          setIsAdmin(false);
          setPending([]);
          setAdminRequests([]);
          setLoading(false);
        }
      }
    );

    loadPublicData();

    return () => listener.subscription.unsubscribe();
  }, []);

  // LOAD PUBLIC WEBSITE DATA
  async function loadPublicData() {
    if (!supabase) return;

    const [alumniResult, eventResult, committeeResult] = await Promise.all([
      supabase.from("public_alumni").select("*"),
      supabase.from("events").select("*").order("event_date", { ascending: true }),
      supabase.from("committee_members").select("*").order("display_order")
    ]);

    if (!alumniResult.error) setAlumni(alumniResult.data || []);
    if (!eventResult.error) setEvents(eventResult.data || []);
    if (!committeeResult.error) setCommittee(committeeResult.data || []);
  }

  // LOAD ACCOUNT AND VERIFY ROLE
  async function loadAccount(userId, authUser = null) {
    if (!supabase || !userId) return;

    setLoading(true);

    try {
      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle(),

        supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("user_id", userId)
          .maybeSingle()
      ]);

      console.log("Account User ID:", userId);
      console.log("Account Role Data:", roleResult.data);
      console.log("Account Role Error:", roleResult.error);

      if (roleResult.error) {
        setMessage("Could not verify account role: " + roleResult.error.message);
        return;
      }

      if (profileResult.error) {
        setMessage("Could not load profile: " + profileResult.error.message);
        return;
      }

      const currentProfile = profileResult.data;
      const admin = roleResult.data?.role === "admin";
      const selectedType =
        localStorage.getItem("smsa_account_type") || "member";

      setProfile(currentProfile || null);
      setIsAdmin(admin);

      if (currentProfile) {
        setForm({
          full_name: currentProfile.full_name || "",
          passing_year: currentProfile.passing_year || "",
          batch: currentProfile.batch || "",
          phone: currentProfile.phone || "",
          blood_group: currentProfile.blood_group || "",
          bio: currentProfile.bio || ""
        });
      }

      // Admin role has priority over password metadata.
      if (admin) {
        const [memberResult, requestResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("approval_status", "pending")
            .order("created_at", { ascending: false }),

          supabase
            .from("admin_requests")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: false })
        ]);

        if (memberResult.error) {
          setMessage("Could not load pending members: " + memberResult.error.message);
        }

        if (requestResult.error) {
          setMessage("Could not load Admin requests: " + requestResult.error.message);
        }

        setPending(memberResult.data || []);
        setAdminRequests(requestResult.data || []);
        setPage("Admin");
        setMessage("");
        return;
      }

      // Non-admin account
      if (!authUser?.user_metadata?.smsa_password_set) {
        setPage("SetPassword");
      } else if (selectedType === "admin") {
        setPage("AdminPending");
        setMessage(
          "This account is not authorised for Admin access. Please wait for Admin approval."
        );
      } else {
        setPage("Profile");
      }
    } catch (error) {
      console.error("Load account error:", error);
      setMessage("Account loading error: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  // CHOOSE MEMBER OR ADMIN PORTAL
  function chooseAccountType(type) {
    setAccountType(type);
    localStorage.setItem("smsa_account_type", type);
    setAuthMode("login");
    setMagicLinkSent(false);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
    setPage("Login");
  }

  function openPortal() {
    setMessage("");
    setPage("Portal");
  }

  // REGISTRATION: SEND VERIFICATION LINK
  async function sendMagicLink(e) {
    e.preventDefault();
    setMessage("");

    if (!supabase) return;

    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin
        }
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMagicLinkSent(true);
        setMessage("Verification link sent. Please check your email.");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // LOGIN WITH EMAIL AND PASSWORD
  async function loginWithPassword(e) {
    e.preventDefault();
    setMessage("");

    if (!supabase) {
      setMessage("Supabase configuration is missing.");
      return;
    }

    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        setMessage("Login failed: " + error.message);
        return;
      }

      if (!data.user || !data.session) {
        setMessage("Login failed: Authentication session was not created.");
        return;
      }

      // SIGNED_IN event in the auth listener will load the account
      // and verify the Admin role. Do not call loadAccount() again here.
      setSession(data.session);
      setMessage("Login successful. Verifying your account...");
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Login error: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // SET PASSWORD AFTER EMAIL VERIFICATION
  async function saveNewPassword(e) {
    e.preventDefault();
    setMessage("");

    if (password.length < 6) {
      setMessage("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (!supabase) return;

    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
        data: { smsa_password_set: true }
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      const currentUser = data.user;

      if (accountType === "admin") {
        const { data: existingRequest, error: checkError } = await supabase
          .from("admin_requests")
          .select("user_id")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (checkError) {
          setMessage(checkError.message);
          return;
        }

        if (!existingRequest) {
          const { error: requestError } = await supabase
            .from("admin_requests")
            .insert({
              user_id: currentUser.id,
              email: currentUser.email,
              status: "pending"
            });

          if (requestError) {
            setMessage(requestError.message);
            return;
          }
        }

        setPassword("");
        setConfirmPassword("");
        setPage("AdminPending");
        setMessage("Admin application submitted. Please wait for authorisation.");
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setMessage("Password saved successfully. Now complete your profile.");
      await loadAccount(currentUser.id, currentUser);
    } catch (error) {
      setMessage("Password update error: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // FORGOT PASSWORD
  async function sendPasswordReset(e) {
    e.preventDefault();
    setMessage("");

    if (!supabase) return;

    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: window.location.origin }
      );

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Password reset link sent. Please check your email.");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // SAVE MEMBER PROFILE
  async function saveProfile(e) {
    e.preventDefault();

    if (!supabase || !session) return;

    if (!form.full_name.trim() || !form.passing_year) {
      setMessage("Please enter your full name and passing year.");
      return;
    }

    setMessage("Saving your profile...");

    const { error } = await supabase.from("profiles").upsert({
      id: session.user.id,
      ...form,
      full_name: form.full_name.trim(),
      passing_year: Number(form.passing_year),
      approval_status: profile?.approval_status || "pending"
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Profile submitted. Please wait for admin approval.");
      await loadAccount(session.user.id, session.user);
    }
  }

  // APPROVE OR REJECT A MEMBER
  async function updateApproval(userId, status) {
    if (!supabase || !isAdmin) return;

    const { error } = await supabase
      .from("profiles")
      .update({ approval_status: status })
      .eq("id", userId);

    if (error) {
      setMessage(error.message);
    } else {
      setPending((old) => old.filter((item) => item.id !== userId));
      setMessage(`Member registration ${status}.`);
      await loadPublicData();
    }
  }

  // APPROVE OR REJECT AN ADMIN APPLICATION
  async function updateAdminRequest(userId, status) {
    if (!supabase || !isAdmin) return;

    if (status === "approved") {
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: userId, role: "admin" },
          { onConflict: "user_id" }
        );

      if (roleError) {
        setMessage("Could not assign Admin role: " + roleError.message);
        return;
      }
    }

    const { error } = await supabase
      .from("admin_requests")
      .update({ status })
      .eq("user_id", userId);

    if (error) {
      setMessage(error.message);
    } else {
      setAdminRequests((old) =>
        old.filter((item) => item.user_id !== userId)
      );
      setMessage(`Admin application ${status}.`);
    }
  }

  // LOGOUT
  async function logout() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setMessage("Logout error: " + error.message);
        return;
      }
    }

    localStorage.setItem("smsa_account_type", "member");
    setAccountType("member");
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setPassword("");
    setConfirmPassword("");
    setMagicLinkSent(false);
    setAuthMode("login");
    setMessage("");
    setPage("Home");
  }

  // NAVIGATION
  function navigate(name) {
    if (name === "Admin" && !isAdmin) {
      setMessage("Admin access required.");
      return;
    }

    if (name === "Profile" && !session) {
      setPage("Portal");
      return;
    }

    setPage(name);
    setMenuOpen(false);
    setMessage("");
  }

  function updateForm(field, value) {
    setForm((old) => ({ ...old, [field]: value }));
  }

  const filteredAlumni = alumni.filter((person) =>
    `${person.full_name} ${person.batch} ${person.passing_year}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="app">
      <header className="navbar">
        <div className="nav-container">
          <button className="brand" onClick={() => navigate("Home")}>
            <span className="brand-icon"><GraduationCap size={27} /></span>
            <span>
              <strong>SMSA</strong>
              <small>Same Mind Student Association</small>
            </span>
          </button>

          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X /> : <Menu />}
          </button>

          <nav className={menuOpen ? "nav-links open" : "nav-links"}>
            {navItems.map((item) => (
              <button
                key={item}
                className={page === item ? "nav-link active" : "nav-link"}
                onClick={() => navigate(item)}
              >
                {item}
              </button>
            ))}

            {session ? (
              <>
                {!isAdmin && (
                  <button className="nav-link" onClick={() => navigate("Profile")}>
                    <UserCircle size={16} /> My Profile
                  </button>
                )}

                {isAdmin && (
                  <button className="nav-link" onClick={() => navigate("Admin")}>
                    <ShieldCheck size={16} /> Admin Dashboard
                  </button>
                )}

                <button className="nav-login" onClick={logout}>
                  <LogOut size={16} /> Logout
                </button>
              </>
            ) : (
              <button className="nav-login" onClick={openPortal}>
                <LogIn size={16} /> Login / Sign Up
              </button>
            )}
          </nav>
        </div>
      </header>

      <main>
        {message && (
          <div className="message container">
            {message}
            <button onClick={() => setMessage("")}><X size={16} /></button>
          </div>
        )}

        {page === "Home" && (
          <>
            <section className="hero">
              <div className="hero-content">
                <span className="eyebrow">WELCOME TO OUR ALUMNI COMMUNITY</span>
                <h1>Once a Student,<br /><span>Always a Family.</span></h1>
                <p>
                  Connecting the past, celebrating the present, and building
                  the future of our beloved institution.
                </p>
                <div className="hero-actions">
                  <button className="btn-primary" onClick={openPortal}>
                    Join Our Community <ArrowRight size={18} />
                  </button>
                  <button className="btn-outline" onClick={() => navigate("Alumni")}>
                    Explore Alumni
                  </button>
                </div>
              </div>
              <div className="hero-art">
                <div className="hero-circle">
                  <GraduationCap size={105} strokeWidth={1.2} />
                  <span>SMSA</span>
                </div>
              </div>
            </section>

            <section className="stats container">
              <div className="stat-card">
                <Users size={27} />
                <strong>{alumni.length}+</strong>
                <span>Registered Alumni</span>
              </div>
              <div className="stat-card">
                <CalendarDays size={27} />
                <strong>{events.length}+</strong>
                <span>Community Events</span>
              </div>
              <div className="stat-card">
                <Heart size={27} />
                <strong>One</strong>
                <span>United Community</span>
              </div>
            </section>

            <section className="section container">
              <div className="section-heading">
                <span className="eyebrow">OUR COMMUNITY</span>
                <h2>More Than Just Alumni</h2>
                <p>Stay connected with friends, classmates, and your institution.</p>
              </div>
              <div className="feature-grid">
                <Feature icon={<Users />} title="Alumni Network"
                  text="Reconnect with your classmates and discover fellow alumni." />
                <Feature icon={<CalendarDays />} title="Events & Reunion"
                  text="Stay updated about reunions, programs, and community events." />
                <Feature icon={<Heart />} title="Stronger Together"
                  text="Build meaningful connections and support one another." />
              </div>
            </section>
          </>
        )}

        {page === "About" && (
          <section className="page-section container">
            <PageHeading label="ABOUT SMSA" title="Our Story" />
            <div className="content-card">
              <h3>Same Mind Student Association</h3>
              <p>
                SMSA is an alumni community for former students of Sakhipur
                Thana Sadar Dakhil Madrasah. Our purpose is to maintain
                lifelong connections, bring former classmates together, and
                create opportunities to support one another.
              </p>
              <p>
                No matter when we graduated or where life has taken us,
                we share a common history and a lasting connection.
              </p>
            </div>
          </section>
        )}

        {page === "Alumni" && (
          <section className="page-section container">
            <PageHeading label="OUR NETWORK" title="Meet Our Alumni" />
            <div className="search-box">
              <Search size={19} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, batch or passing year..."
              />
            </div>
            <div className="alumni-grid">
              {filteredAlumni.map((person) => (
                <div className="alumni-card" key={person.id}>
                  <div className="avatar">
                    {person.photo_url
                      ? <img src={person.photo_url} alt={person.full_name} />
                      : <UserCircle size={48} />}
                  </div>
                  <h3>{person.full_name}</h3>
                  <p>Batch: {person.batch || "Not specified"}</p>
                  <span>Passing Year: {person.passing_year || "N/A"}</span>
                </div>
              ))}
              {filteredAlumni.length === 0 && (
                <p className="empty-state">No approved alumni found.</p>
              )}
            </div>
          </section>
        )}

        {page === "Events" && (
          <section className="page-section container">
            <PageHeading label="STAY CONNECTED" title="Events & Announcements" />
            <div className="event-grid">
              {events.map((event) => (
                <article className="event-card" key={event.id}>
                  <div className="event-icon"><CalendarDays size={28} /></div>
                  <h3>{event.title}</h3>
                  <p>{event.description}</p>
                  {event.event_date && (
                    <span><Clock size={15} /> {event.event_date}</span>
                  )}
                  {event.location && (
                    <span><MapPin size={15} /> {event.location}</span>
                  )}
                </article>
              ))}
              {events.length === 0 && (
                <p className="empty-state">No events have been published yet.</p>
              )}
            </div>
          </section>
        )}

        {page === "Committee" && (
          <section className="page-section container">
            <PageHeading label="LEADERSHIP" title="Our Executive Committee" />
            <div className="committee-grid">
              {committee.map((member) => (
                <div className="committee-card" key={member.id}>
                  <div className="avatar">
                    {member.photo_url
                      ? <img src={member.photo_url} alt={member.name} />
                      : <UserCircle size={48} />}
                  </div>
                  <h3>{member.name}</h3>
                  <strong>{member.position}</strong>
                  <span>{member.batch || ""}</span>
                </div>
              ))}
              {committee.length === 0 && (
                <p className="empty-state">Committee information will be published here.</p>
              )}
            </div>
          </section>
        )}

        {/* PORTAL SELECTION */}
        {page === "Portal" && (
          <section className="auth-section">
            <div className="auth-card">
              <div className="auth-icon"><GraduationCap size={30} /></div>
              <span className="eyebrow">SMSA ACCOUNT ACCESS</span>
              <h2>Choose Your Portal</h2>
              <p>Select how you want to access the SMSA platform.</p>

              <button
                className="btn-primary full-width"
                onClick={() => chooseAccountType("member")}
              >
                <Users size={18} /> Member Portal
                <ArrowRight size={17} />
              </button>

              <button
                className="btn-outline full-width portal-admin-button"
                onClick={() => chooseAccountType("admin")}
              >
                <ShieldCheck size={18} /> Admin Portal
                <ArrowRight size={17} />
              </button>

              <div className="auth-note">
                <Lock size={16} />
                Admin access is restricted to authorised administrators.
              </div>
            </div>
          </section>
        )}

        {/* ADMIN AND MEMBER LOGIN / REGISTRATION */}
        {page === "Login" && (
          <section className="auth-section">
            <div className="auth-card">
              <div className="auth-icon">
                {accountType === "admin"
                  ? <ShieldCheck size={30} />
                  : <Mail size={30} />}
              </div>

              <span className="eyebrow">
                {accountType === "admin" ? "ADMIN PORTAL" : "MEMBER PORTAL"}
              </span>

              {authMode === "login" ? (
                <>
                  <h2>{accountType === "admin" ? "Admin Login" : "Member Login"}</h2>
                  <p>Login using your registered email and password.</p>

                  <form onSubmit={loginWithPassword}>
                    <label>Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />

                    <label>Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />

                    <button
                      className="btn-primary full-width"
                      type="submit"
                      disabled={authLoading}
                    >
                      {authLoading ? "Please wait..." : "Login"}
                      <ArrowRight size={17} />
                    </button>
                  </form>

                  <button
                    className="text-button"
                    type="button"
                    onClick={() => {
                      setMessage("");
                      setPage("ForgotPassword");
                    }}
                  >
                    Forgot Password?
                  </button>

                  <p className="auth-switch">
                    Don't have an account?{" "}
                    <button onClick={() => {
                      setAuthMode("signup");
                      setPassword("");
                      setMessage("");
                    }}>
                      Register Now
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <h2>{magicLinkSent ? "Check Your Email" : "Create Account"}</h2>
                  <p>
                    {accountType === "admin"
                      ? "Apply for an Admin account using your email address."
                      : "Register as an SMSA member using your email address."}
                  </p>

                  {!magicLinkSent ? (
                    <form onSubmit={sendMagicLink}>
                      <label>Email Address</label>
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />

                      <button
                        className="btn-primary full-width"
                        type="submit"
                        disabled={authLoading}
                      >
                        {authLoading ? "Sending..." : "Send Verification Link"}
                        <ArrowRight size={17} />
                      </button>
                    </form>
                  ) : (
                    <div className="auth-note">
                      <Mail size={18} />
                      Check your inbox and spam folder. Click the verification link to continue.
                    </div>
                  )}

                  <button
                    className="text-button"
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setMagicLinkSent(false);
                      setMessage("");
                    }}
                  >
                    Back to Login
                  </button>
                </>
              )}

              <div className="auth-note">
                <ShieldCheck size={16} />
                {accountType === "admin"
                  ? "Admin access requires approval by an authorised administrator."
                  : "Your member profile will be reviewed by an SMSA administrator."}
              </div>

              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setPage("Portal");
                  setMessage("");
                  setPassword("");
                }}
              >
                Change Portal
              </button>
            </div>
          </section>
        )}

        {/* ADMIN APPLICATION PENDING */}
        {page === "AdminPending" && (
          <section className="auth-section">
            <div className="auth-card">
              <div className="auth-icon"><ShieldCheck size={32} /></div>
              <span className="eyebrow">ADMIN AUTHORISATION</span>
              <h2>Application Pending</h2>
              <p>
                Your Admin account has been registered, but Admin access has
                not been granted yet.
              </p>
              <div className="auth-note">
                <Clock size={18} />
                An authorised SMSA administrator must approve your application
                before you can access the Admin Dashboard.
              </div>
              <button
                className="btn-outline full-width"
                onClick={logout}
              >
                Logout
              </button>
            </div>
          </section>
        )}

        {/* SET PASSWORD */}
        {page === "SetPassword" && (
          <section className="auth-section">
            <div className="auth-card">
              <div className="auth-icon"><Lock size={30} /></div>
              <span className="eyebrow">ACCOUNT SECURITY</span>
              <h2>Set Your Password</h2>
              <p>Your email has been verified. Create a password for future login.</p>

              <form onSubmit={saveNewPassword}>
                <label>New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <label>Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Enter password again"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <button
                  className="btn-primary full-width"
                  type="submit"
                  disabled={authLoading}
                >
                  {authLoading ? "Saving..." : "Save Password & Continue"}
                  <ArrowRight size={17} />
                </button>
              </form>

              <div className="auth-note">
                <ShieldCheck size={16} />
                Your password is securely managed by Supabase Authentication.
              </div>
            </div>
          </section>
        )}

        {/* FORGOT PASSWORD */}
        {page === "ForgotPassword" && (
          <section className="auth-section">
            <div className="auth-card">
              <div className="auth-icon"><KeyRound size={30} /></div>
              <span className="eyebrow">ACCOUNT RECOVERY</span>
              <h2>Forgot Password?</h2>
              <p>Enter your account email. We will send you a password reset link.</p>

              <form onSubmit={sendPasswordReset}>
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <button
                  className="btn-primary full-width"
                  type="submit"
                  disabled={authLoading}
                >
                  {authLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setPage("Login");
                  setMessage("");
                }}
              >
                Back to Login
              </button>
            </div>
          </section>
        )}

        {/* RESET PASSWORD */}
        {page === "ResetPassword" && (
          <section className="auth-section">
            <div className="auth-card">
              <div className="auth-icon"><Lock size={30} /></div>
              <span className="eyebrow">ACCOUNT RECOVERY</span>
              <h2>Create New Password</h2>
              <p>Enter and confirm your new password.</p>

              <form onSubmit={saveNewPassword}>
                <label>New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <label>Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Enter password again"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <button
                  className="btn-primary full-width"
                  type="submit"
                  disabled={authLoading}
                >
                  {authLoading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* MEMBER PROFILE */}
        {page === "Profile" && (
          <section className="page-section container">
            <PageHeading label="MEMBER ACCOUNT" title="My Profile" />

            {loading ? <p>Loading account...</p> : (
              <>
                <div className="status-card">
                  <strong>Registration Status:</strong>
                  <span className={`status ${profile?.approval_status || "pending"}`}>
                    {profile?.approval_status || "Not submitted"}
                  </span>
                </div>

                <form className="profile-form content-card" onSubmit={saveProfile}>
                  <h3>Personal Information</h3>

                  <div className="form-grid">
                    <FormField label="Full Name" value={form.full_name}
                      onChange={(v) => updateForm("full_name", v)} required />

                    <FormField label="Passing Year" type="number" value={form.passing_year}
                      onChange={(v) => updateForm("passing_year", v)} required />

                    <FormField label="Batch" value={form.batch}
                      onChange={(v) => updateForm("batch", v)} />

                    <FormField label="Phone Number" value={form.phone}
                      onChange={(v) => updateForm("phone", v)} />

                    <div className="field">
                      <label>Blood Group</label>
                      <select
                        value={form.blood_group}
                        onChange={(e) => updateForm("blood_group", e.target.value)}
                      >
                        <option value="">Select blood group</option>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) =>
                          <option key={g}>{g}</option>
                        )}
                      </select>
                    </div>

                    <div className="field full-field">
                      <label>Short Bio</label>
                      <textarea
                        value={form.bio}
                        onChange={(e) => updateForm("bio", e.target.value)}
                        placeholder="Tell us a little about yourself..."
                      />
                    </div>
                  </div>

                  <button className="btn-primary" type="submit">Save Profile</button>
                </form>
              </>
            )}
          </section>
        )}

        {/* ADMIN DASHBOARD */}
        {page === "Admin" && (
          <section className="page-section container">
            <PageHeading label="ADMINISTRATION" title="Admin Dashboard" />

            {!isAdmin ? (
              <div className="content-card">
                <ShieldCheck size={35} />
                <h3>Admin access required</h3>
                <p>This section is only available to authorised administrators.</p>
              </div>
            ) : (
              <>
                <div className="content-card">
                  <h3>Pending Member Registrations ({pending.length})</h3>

                  {pending.length === 0 && <p>No pending member registrations.</p>}

                  {pending.map((person) => (
                    <div className="pending-row" key={person.id}>
                      <div>
                        <strong>{person.full_name}</strong>
                        <span>{person.batch} · {person.passing_year}</span>
                        <small>{person.phone}</small>
                      </div>

                      <div className="pending-actions">
                        <button
                          className="approve-btn"
                          onClick={() => updateApproval(person.id, "approved")}
                        >
                          Approve
                        </button>
                        <button
                          className="reject-btn"
                          onClick={() => updateApproval(person.id, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="content-card" style={{ marginTop: "24px" }}>
                  <h3>Pending Admin Applications ({adminRequests.length})</h3>

                  {adminRequests.length === 0 && <p>No pending Admin applications.</p>}

                  {adminRequests.map((request) => (
                    <div className="pending-row" key={request.user_id}>
                      <div>
                        <strong>{request.email}</strong>
                        <span>Admin access request</span>
                        <small>
                          {new Date(request.created_at).toLocaleDateString()}
                        </small>
                      </div>

                      <div className="pending-actions">
                        <button
                          className="approve-btn"
                          onClick={() => updateAdminRequest(request.user_id, "approved")}
                        >
                          Approve
                        </button>
                        <button
                          className="reject-btn"
                          onClick={() => updateAdminRequest(request.user_id, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="container footer-content">
          <div>
            <h2>SMSA</h2>
            <p>Same Mind Student Association</p>
            <span>Connecting generations, building friendships.</span>
          </div>
          <p>© {new Date().getFullYear()} SMSA. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, text }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function PageHeading({ label, title }) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{label}</span>
      <h1>{title}</h1>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", required = false }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}