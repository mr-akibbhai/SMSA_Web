
import { useEffect, useState } from "react";
import {
  Menu, X, Users, GraduationCap, CalendarDays, ShieldCheck,
  LogIn, LogOut, UserCircle, ArrowRight, Heart,
  Search, Clock, MapPin, KeyRound, Trash2, Edit,
  Plus, Save, Ban, RefreshCw
} from "lucide-react";
import { supabase } from "./lib/supabase";

const navItems = ["Home", "About", "Alumni", "Events", "Committee"];

const emptyForm = {
  full_name: "",
  address: "",
  passing_year: "",
  batch: "",
  phone: "",
  blood_group: "",
  bio: ""
};

export default function App() {
  const [page, setPage] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [loginType, setLoginType] = useState("member");
  const [authLoading, setAuthLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [alumni, setAlumni] = useState([]);
  const [events, setEvents] = useState([]);
  const [committee, setCommittee] = useState([]);
  const [members, setMembers] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [editingMember, setEditingMember] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingCommittee, setEditingCommittee] = useState(null);

  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    event_date: "",
    location: ""
  });

  const [committeeForm, setCommitteeForm] = useState({
    name: "",
    position: "",
    batch: "",
    photo_url: "",
    display_order: 0
  });

  // AUTH INITIALIZATION
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setMessage("Supabase configuration is missing.");
      return;
    }

    let mounted = true;

    async function initialize() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setMessage(error.message);
      }

      if (mounted && data?.session) {
        setSession(data.session);
        await loadAccount(data.session.user);
      } else if (mounted) {
        setLoading(false);
      }

      if (mounted) {
        await loadPublicData();
      }
    }

    initialize();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;

        if (event === "PASSWORD_RECOVERY") {
          setSession(newSession);
          setPage("ResetPassword");
          setLoading(false);
          return;
        }

        if (event === "SIGNED_IN" && newSession) {
          setSession(newSession);

          setTimeout(() => {
            if (mounted) {
              loadAccount(newSession.user);
            }
          }, 0);
        }

        if (event === "SIGNED_OUT") {
          setSession(null);
          setProfile(null);
          setIsAdmin(false);
          setMembers([]);
          setPage("Home");
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // PUBLIC DATA
  async function loadPublicData() {
    if (!supabase) return;

    const [a, e, c] = await Promise.all([
      supabase.from("public_alumni").select("*"),
      supabase.from("events").select("*").order("event_date"),
      supabase.from("committee_members").select("*").order("display_order")
    ]);

    if (!a.error) setAlumni(a.data || []);
    if (!e.error) setEvents(e.data || []);
    if (!c.error) setCommittee(c.data || []);
  }

  // LOAD ACCOUNT AND VERIFY DATABASE ROLE
  async function loadAccount(user) {
    if (!supabase || !user) return;

    setLoading(true);

    try {
      const [p, r] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle()
      ]);

      if (p.error) throw p.error;
      if (r.error) throw r.error;

      const admin = r.data?.role === "admin";

      setIsAdmin(admin);
      setProfile(p.data || null);

      if (p.data) {
        setForm({
          ...emptyForm,
          ...p.data,
          passing_year: p.data.passing_year || ""
        });
      } else {
        setForm({
          ...emptyForm,
          full_name: user.user_metadata?.full_name || ""
        });
      }

      if (admin) {
        setPage("Admin");
        await loadAdminData();
      } else {
        setPage("Profile");
      }

      setMessage("");
    } catch (error) {
      setMessage("Account loading error: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  // ADMIN DATA
  async function loadAdminData() {
    if (!session && !isAdmin) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Could not load members: " + error.message);
      return;
    }

    setMembers(data || []);
  }

  // NAVIGATION
  function navigate(name) {
    if (name === "Admin" && !isAdmin) {
      setMessage("Admin access required.");
      return;
    }

    if (name === "Profile" && !session) {
      openMemberLogin();
      return;
    }

    setPage(name);
    setMenuOpen(false);
    setMessage("");
  }

  function openAdminLogin() {
    setLoginType("admin");
    setAuthMode("login");
    setPage("Login");
    setMenuOpen(false);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  function openMemberLogin() {
    setLoginType("member");
    setAuthMode("login");
    setPage("Login");
    setMenuOpen(false);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  function openMemberRegistration() {
    setLoginType("member");
    setAuthMode("signup");
    setPage("Login");
    setMenuOpen(false);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  function updateForm(field, value) {
    setForm(old => ({ ...old, [field]: value }));
  }

  // MEMBER REGISTRATION
  async function registerMember(e) {
    e.preventDefault();
    setMessage("");

    if (loginType !== "member") {
      setMessage("Only members can register.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (!form.full_name.trim() || !form.passing_year) {
      setMessage("Full Name and Passing Year are required.");
      return;
    }

    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: form.full_name.trim()
          }
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error("Registration failed.");

      if (!data.session) {
        setMessage(
          "Account created, but direct login is unavailable. Please check that Supabase Email Confirmation is OFF."
        );
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: data.user.id,
          ...form,
          full_name: form.full_name.trim(),
          address: form.address.trim() || null,
          passing_year: Number(form.passing_year),
          approval_status: "approved"
        });

      if (profileError) throw profileError;

      setPassword("");
      setConfirmPassword("");
      setSession(data.session);
      await loadAccount(data.user);
      setMessage("Member registration successful.");
    } catch (error) {
      setMessage("Registration error: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // SEPARATE ADMIN AND MEMBER LOGIN
  async function login(e) {
    e.preventDefault();
    setMessage("");
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) throw error;

      // Verify role directly from Supabase
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      const userIsAdmin = roleData?.role === "admin";

      // Admin login cannot be used by normal members
      if (loginType === "admin" && !userIsAdmin) {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setIsAdmin(false);
        setPage("Login");
        setMessage(
          "Access denied. This account is not authorised as an Admin."
        );
        return;
      }

      // Member login cannot be used by Admin accounts
      if (loginType === "member" && userIsAdmin) {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setIsAdmin(false);
        setPage("Login");
        setMessage("This is an Admin account. Please use Admin Login.");
        return;
      }

      setSession(data.session);
      await loadAccount(data.user);

      setMessage(
        userIsAdmin
          ? "Admin login successful."
          : "Member login successful."
      );
    } catch (error) {
      setMessage("Login failed: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // FORGOT PASSWORD
  async function sendPasswordReset(e) {
    e.preventDefault();
    setMessage("");
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: window.location.origin }
      );

      if (error) throw error;

      setMessage("Password reset link sent. Check your email.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // UPDATE PASSWORD
  async function updatePassword(e) {
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

    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");

      if (session) {
        await loadAccount(session.user);
      } else {
        setPage("Login");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // SAVE OWN PROFILE
  async function saveProfile(e) {
    e.preventDefault();

    if (!session) return;

    if (!form.full_name.trim() || !form.passing_year) {
      setMessage("Full Name and Passing Year are required.");
      return;
    }

    setAuthLoading(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .upsert({
          id: session.user.id,
          ...form,
          full_name: form.full_name.trim(),
          address: form.address.trim() || null,
          passing_year: Number(form.passing_year),
          approval_status: "approved"
        })
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      setMessage("Profile saved successfully.");
      await loadPublicData();
    } catch (error) {
      setMessage("Profile save failed: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // ADMIN: EDIT MEMBER
  async function adminUpdateMember(e) {
    e.preventDefault();
    if (!isAdmin || !editingMember) return;

    setAuthLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editingMember.full_name,
          address: editingMember.address || null,
          passing_year: Number(editingMember.passing_year),
          batch: editingMember.batch,
          phone: editingMember.phone,
          blood_group: editingMember.blood_group,
          bio: editingMember.bio
        })
        .eq("id", editingMember.id);

      if (error) throw error;

      setEditingMember(null);
      setMessage("Member profile updated.");
      await loadAdminData();
      await loadPublicData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // ADMIN: DELETE PROFILE DATA ONLY
  async function deleteMemberProfile(userId) {
    if (!isAdmin) return;

    if (userId === session?.user?.id) {
      setMessage("You cannot delete your own Admin profile here.");
      return;
    }

    if (!window.confirm(
      "Delete this member's profile data? This does not delete the Auth account."
    )) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Profile data deleted. Auth account still exists.");
      await loadAdminData();
      await loadPublicData();
    }
  }

  // ADMIN: DISABLE / ENABLE / DELETE AUTH ACCOUNT
  async function manageAuthAccount(userId, action) {
    if (!isAdmin) return;

    if (userId === session?.user?.id) {
      setMessage("You cannot disable or delete your own Admin account.");
      return;
    }

    const confirmText = action === "delete"
      ? "Permanently delete this account? This action cannot be undone."
      : action === "ban"
        ? "Disable this member's login?"
        : "Re-enable this member's login?";

    if (!window.confirm(confirmText)) return;

    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-manage-user",
        { body: { user_id: userId, action } }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessage(data?.message || "Account action completed.");
      await loadAdminData();
    } catch (error) {
      setMessage(
        "Account action failed: " + error.message +
        ". Make sure the admin-manage-user Edge Function is deployed."
      );
    }
  }

  // ADMIN: EVENTS
  async function saveEvent(e) {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const eventData = {
        ...eventForm,
        event_date: eventForm.event_date || null
      };

      const query = editingEvent
        ? supabase.from("events").update(eventData).eq("id", editingEvent)
        : supabase.from("events").insert(eventData);

      const { error } = await query;
      if (error) throw error;

      setEventForm({
        title: "",
        description: "",
        event_date: "",
        location: ""
      });

      setEditingEvent(null);
      setMessage("Event saved.");
      await loadPublicData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteEvent(id) {
    if (!isAdmin || !window.confirm("Delete this event?")) return;

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Event deleted.");
      await loadPublicData();
    }
  }

  // ADMIN: COMMITTEE
  async function saveCommittee(e) {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const query = editingCommittee
        ? supabase
          .from("committee_members")
          .update(committeeForm)
          .eq("id", editingCommittee)
        : supabase
          .from("committee_members")
          .insert(committeeForm);

      const { error } = await query;
      if (error) throw error;

      setCommitteeForm({
        name: "",
        position: "",
        batch: "",
        photo_url: "",
        display_order: 0
      });

      setEditingCommittee(null);
      setMessage("Committee member saved.");
      await loadPublicData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteCommittee(id) {
    if (!isAdmin || !window.confirm("Delete this committee member?")) return;

    const { error } = await supabase
      .from("committee_members")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Committee member deleted.");
      await loadPublicData();
    }
  }

  // LOGOUT
  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      return;
    }

    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setMembers([]);
    setForm(emptyForm);
    setPassword("");
    setConfirmPassword("");
    setEmail("");
    setLoginType("member");
    setAuthMode("login");
    setPage("Home");
    setMessage("");
  }

  const filteredAlumni = alumni.filter(person =>
    `${person.full_name} ${person.batch} ${person.passing_year}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="app">
      <header className="navbar">
        <div className="nav-container">
          <button className="brand" onClick={() => navigate("Home")}>
            <span className="brand-icon">
              <GraduationCap size={27} />
            </span>
            <span>
              <strong>SMSA</strong>
              <small>Same Mind Student Association</small>
            </span>
          </button>

          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>

          <nav className={menuOpen ? "nav-links open" : "nav-links"}>
            {navItems.map(item => (
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
                  <button
                    className="nav-link"
                    onClick={() => navigate("Profile")}
                  >
                    <UserCircle size={16} /> My Profile
                  </button>
                )}

                {isAdmin && (
                  <button
                    className="nav-link"
                    onClick={() => navigate("Admin")}
                  >
                    <ShieldCheck size={16} /> Admin Dashboard
                  </button>
                )}

                <button className="nav-login" onClick={logout}>
                  <LogOut size={16} /> Logout
                </button>
              </>
            ) : (
              <>
                <button
                  className="nav-login"
                  onClick={openAdminLogin}
                >
                  <ShieldCheck size={16} /> Admin Login
                </button>

                <button
                  className="nav-login"
                  onClick={openMemberLogin}
                >
                  <Users size={16} /> Member Login
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {message && (
          <div className="message container">
            {message}
            <button onClick={() => setMessage("")}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* HOME */}
        {page === "Home" && (
          <>
            <section className="hero">
              <div className="hero-content">
                <span className="eyebrow">
                  WELCOME TO OUR ALUMNI COMMUNITY
                </span>

                <h1>
                  Once a Student,<br />
                  <span>Always a Family.</span>
                </h1>

                <p>
                  Connecting the past, celebrating the present, and building
                  the future of our beloved institution.
                </p>

                <div className="hero-actions">
                  <button
                    className="btn-primary"
                    onClick={openMemberRegistration}
                  >
                    Join Our Community <ArrowRight size={18} />
                  </button>

                  <button
                    className="btn-outline"
                    onClick={() => navigate("Alumni")}
                  >
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
                <p>
                  Stay connected with friends, classmates, and your institution.
                </p>
              </div>

              <div className="feature-grid">
                <Feature
                  icon={<Users />}
                  title="Alumni Network"
                  text="Reconnect with your classmates and discover fellow alumni."
                />

                <Feature
                  icon={<CalendarDays />}
                  title="Events & Reunion"
                  text="Stay updated about reunions, programs, and community events."
                />

                <Feature
                  icon={<Heart />}
                  title="Stronger Together"
                  text="Build meaningful connections and support one another."
                />
              </div>
            </section>
          </>
        )}

        {/* ABOUT */}
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

        {/* ALUMNI */}
        {page === "Alumni" && (
          <section className="page-section container">
            <PageHeading label="OUR NETWORK" title="Meet Our Alumni" />

            <div className="search-box">
              <Search size={19} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, batch or passing year..."
              />
            </div>

            <div className="alumni-grid">
              {filteredAlumni.map(person => (
                <div className="alumni-card" key={person.id}>
                  <div className="avatar">
                    {person.photo_url
                      ? <img src={person.photo_url} alt={person.full_name} />
                      : <UserCircle size={48} />}
                  </div>

                  <h3>{person.full_name}</h3>
                  <p>Batch: {person.batch || "Not specified"}</p>
                  <span>
                    Passing Year: {person.passing_year || "N/A"}
                  </span>
                </div>
              ))}

              {filteredAlumni.length === 0 && (
                <p className="empty-state">No alumni found.</p>
              )}
            </div>
          </section>
        )}

        {/* EVENTS */}
        {page === "Events" && (
          <section className="page-section container">
            <PageHeading
              label="STAY CONNECTED"
              title="Events & Announcements"
            />

            <div className="event-grid">
              {events.map(event => (
                <article className="event-card" key={event.id}>
                  <div className="event-icon">
                    <CalendarDays size={28} />
                  </div>

                  <h3>{event.title}</h3>
                  <p>{event.description}</p>

                  {event.event_date && (
                    <span>
                      <Clock size={15} /> {event.event_date}
                    </span>
                  )}

                  {event.location && (
                    <span>
                      <MapPin size={15} /> {event.location}
                    </span>
                  )}
                </article>
              ))}

              {events.length === 0 && (
                <p className="empty-state">
                  No events have been published yet.
                </p>
              )}
            </div>
          </section>
        )}

        {/* COMMITTEE */}
        {page === "Committee" && (
          <section className="page-section container">
            <PageHeading
              label="LEADERSHIP"
              title="Our Executive Committee"
            />

            <div className="committee-grid">
              {committee.map(member => (
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
                <p className="empty-state">
                  Committee information will be published here.
                </p>
              )}
            </div>
          </section>
        )}

        {/* LOGIN AND REGISTRATION */}
        {page === "Login" && (
          <section className="auth-section">
            <div className="auth-card">
              <div className="auth-icon">
                {loginType === "admin"
                  ? <ShieldCheck size={30} />
                  : <GraduationCap size={30} />}
              </div>

              <span className="eyebrow">
                {loginType === "admin"
                  ? "SMSA ADMINISTRATION"
                  : "SMSA MEMBER ACCOUNT"}
              </span>

              {/* LOGIN */}
              {authMode === "login" && (
                <>
                  <h2>
                    {loginType === "admin" ? "Admin Login" : "Member Login"}
                  </h2>

                  <p>
                    {loginType === "admin"
                      ? "Login using your authorised Admin account."
                      : "Login using your registered email and password."}
                  </p>

                  <form onSubmit={login}>
                    <label>Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      placeholder="you@example.com"
                      onChange={e => setEmail(e.target.value)}
                    />

                    <label>Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      placeholder="Enter your password"
                      onChange={e => setPassword(e.target.value)}
                    />

                    <button
                      className="btn-primary full-width"
                      disabled={authLoading}
                    >
                      {authLoading ? "Please wait..." : "Login"}
                      <ArrowRight size={17} />
                    </button>
                  </form>

                  <button
                    className="text-button"
                    onClick={() => {
                      setAuthMode("forgot");
                      setMessage("");
                    }}
                  >
                    Forgot Password?
                  </button>

                  {loginType === "member" && (
                    <p className="auth-switch">
                      Don't have an account?{" "}
                      <button onClick={openMemberRegistration}>
                        Register Now
                      </button>
                    </p>
                  )}

                  <div className="auth-note">
                    <ShieldCheck size={16} />
                    {loginType === "admin"
                      ? "Restricted to authorised Admin accounts only."
                      : "Member accounts cannot access the Admin Dashboard."}
                  </div>

                  <button
                    type="button"
                    className="text-button"
                    onClick={
                      loginType === "admin"
                        ? openMemberLogin
                        : openAdminLogin
                    }
                  >
                    {loginType === "admin"
                      ? "Go to Member Login"
                      : "Go to Admin Login"}
                  </button>
                </>
              )}

              {/* MEMBER REGISTRATION */}
              {authMode === "signup" && loginType === "member" && (
                <>
                  <h2>Create Member Account</h2>
                  <p>Fill in your information to join SMSA.</p>

                  <form onSubmit={registerMember}>
                    <label>Full Name</label>
                    <input
                      required
                      value={form.full_name}
                      onChange={e => updateForm("full_name", e.target.value)}
                    />

                    <label>Address (Optional)</label>
                    <input
                      value={form.address}
                      onChange={e => updateForm("address", e.target.value)}
                      placeholder="Your address"
                    />

                    <label>Passing Year</label>
                    <input
                      type="number"
                      required
                      value={form.passing_year}
                      onChange={e => updateForm("passing_year", e.target.value)}
                    />

                    <label>Batch</label>
                    <input
                      value={form.batch}
                      onChange={e => updateForm("batch", e.target.value)}
                    />

                    <label>Phone Number</label>
                    <input
                      value={form.phone}
                      onChange={e => updateForm("phone", e.target.value)}
                    />

                    <label>Blood Group</label>
                    <select
                      value={form.blood_group}
                      onChange={e => updateForm("blood_group", e.target.value)}
                    >
                      <option value="">Select blood group</option>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>

                    <label>Short Bio</label>
                    <textarea
                      value={form.bio}
                      onChange={e => updateForm("bio", e.target.value)}
                      placeholder="Tell us about yourself..."
                    />

                    <label>Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      placeholder="you@example.com"
                      onChange={e => setEmail(e.target.value)}
                    />

                    <label>Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      placeholder="At least 6 characters"
                      onChange={e => setPassword(e.target.value)}
                    />

                    <label>Confirm Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      placeholder="Enter password again"
                      onChange={e => setConfirmPassword(e.target.value)}
                    />

                    <button
                      className="btn-primary full-width"
                      disabled={authLoading}
                    >
                      {authLoading ? "Creating account..." : "Register"}
                      <ArrowRight size={17} />
                    </button>
                  </form>

                  <p className="auth-switch">
                    Already registered?{" "}
                    <button
                      onClick={() => {
                        setAuthMode("login");
                        setMessage("");
                      }}
                    >
                      Login
                    </button>
                  </p>
                </>
              )}

              {/* FORGOT PASSWORD */}
              {authMode === "forgot" && (
                <>
                  <h2>Forgot Password?</h2>
                  <p>Enter your email to receive a password reset link.</p>

                  <form onSubmit={sendPasswordReset}>
                    <label>Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />

                    <button
                      className="btn-primary full-width"
                      disabled={authLoading}
                    >
                      {authLoading ? "Sending..." : "Send Reset Link"}
                    </button>
                  </form>

                  <button
                    className="text-button"
                    onClick={() => {
                      setAuthMode("login");
                      setMessage("");
                    }}
                  >
                    Back to {loginType === "admin" ? "Admin" : "Member"} Login
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {/* RESET PASSWORD */}
        {page === "ResetPassword" && (
          <section className="auth-section">
            <div className="auth-card">
              <div className="auth-icon">
                <KeyRound size={30} />
              </div>

              <h2>Create New Password</h2>

              <form onSubmit={updatePassword}>
                <label>New Password</label>
                <input
                  type="password"
                  minLength={6}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />

                <label>Confirm New Password</label>
                <input
                  type="password"
                  minLength={6}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />

                <button
                  className="btn-primary full-width"
                  disabled={authLoading}
                >
                  Update Password
                </button>
              </form>
            </div>
          </section>
        )}

        {/* MEMBER PROFILE */}
        {page === "Profile" && (
          <section className="page-section container">
            <PageHeading label="MEMBER ACCOUNT" title="My Profile" />

            {loading ? (
              <p>Loading account...</p>
            ) : (
              <form
                className="profile-form content-card"
                onSubmit={saveProfile}
              >
                <h3>Personal Information</h3>

                <div className="form-grid">
                  <FormField
                    label="Full Name"
                    value={form.full_name}
                    onChange={v => updateForm("full_name", v)}
                    required
                  />

                  <FormField
                    label="Address (Optional)"
                    value={form.address}
                    onChange={v => updateForm("address", v)}
                  />

                  <FormField
                    label="Passing Year"
                    type="number"
                    value={form.passing_year}
                    onChange={v => updateForm("passing_year", v)}
                    required
                  />

                  <FormField
                    label="Batch"
                    value={form.batch}
                    onChange={v => updateForm("batch", v)}
                  />

                  <FormField
                    label="Phone Number"
                    value={form.phone}
                    onChange={v => updateForm("phone", v)}
                  />

                  <div className="field">
                    <label>Blood Group</label>
                    <select
                      value={form.blood_group}
                      onChange={e => updateForm("blood_group", e.target.value)}
                    >
                      <option value="">Select blood group</option>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field full-field">
                    <label>Short Bio</label>
                    <textarea
                      value={form.bio}
                      onChange={e => updateForm("bio", e.target.value)}
                    />
                  </div>
                </div>

                <button className="btn-primary" disabled={authLoading}>
                  <Save size={17} /> Save Profile
                </button>
              </form>
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
              </div>
            ) : (
              <>
                {/* MEMBER MANAGEMENT */}
                <div className="content-card">
                  <h3>Member Management ({members.length})</h3>
                  <p>
                    Admin can edit member data and manage account access.
                  </p>

                  {members.map(person => (
                    <div className="pending-row" key={person.id}>
                      <div>
                        <strong>{person.full_name}</strong>
                        <span>
                          Batch: {person.batch || "Not specified"} ·
                          {" "}{person.passing_year || "N/A"}
                        </span>
                        <small>{person.phone}</small>
                      </div>

                      <div className="pending-actions">
                        <button
                          className="approve-btn"
                          onClick={() => setEditingMember({ ...person })}
                        >
                          <Edit size={14} /> Edit
                        </button>

                        {person.id !== session?.user?.id && (
                          <>
                            <button
                              className="reject-btn"
                              onClick={() => manageAuthAccount(person.id, "ban")}
                            >
                              <Ban size={14} /> Disable
                            </button>

                            <button
                              className="approve-btn"
                              onClick={() => manageAuthAccount(person.id, "unban")}
                            >
                              <RefreshCw size={14} /> Enable
                            </button>

                            <button
                              className="reject-btn"
                              onClick={() => manageAuthAccount(person.id, "delete")}
                            >
                              <Trash2 size={14} /> Delete Account
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {members.length === 0 && (
                    <p className="empty-state">No member profiles found.</p>
                  )}
                </div>

                {/* EDIT MEMBER */}
                {editingMember && (
                  <form
                    className="content-card profile-form"
                    onSubmit={adminUpdateMember}
                  >
                    <h3>Edit Member</h3>

                    <div className="form-grid">
                      {[
                        "full_name",
                        "address",
                        "passing_year",
                        "batch",
                        "phone",
                        "blood_group",
                        "bio"
                      ].map(field => (
                        <FormField
                          key={field}
                          label={field.replace("_", " ")}
                          value={editingMember[field] || ""}
                          onChange={v => setEditingMember(old => ({
                            ...old,
                            [field]: v
                          }))}
                        />
                      ))}
                    </div>

                    <button className="btn-primary" disabled={authLoading}>
                      Save Changes
                    </button>

                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setEditingMember(null)}
                    >
                      Cancel
                    </button>
                  </form>
                )}

                {/* EVENT MANAGEMENT */}
                <div className="content-card" style={{ marginTop: 24 }}>
                  <h3>Manage Events</h3>

                  <form onSubmit={saveEvent}>
                    <label>Event Title</label>
                    <input
                      required
                      value={eventForm.title}
                      onChange={e => setEventForm({
                        ...eventForm,
                        title: e.target.value
                      })}
                    />

                    <label>Description</label>
                    <textarea
                      value={eventForm.description}
                      onChange={e => setEventForm({
                        ...eventForm,
                        description: e.target.value
                      })}
                    />

                    <label>Date</label>
                    <input
                      type="date"
                      value={eventForm.event_date}
                      onChange={e => setEventForm({
                        ...eventForm,
                        event_date: e.target.value
                      })}
                    />

                    <label>Location</label>
                    <input
                      value={eventForm.location}
                      onChange={e => setEventForm({
                        ...eventForm,
                        location: e.target.value
                      })}
                    />

                    <button className="btn-primary">
                      <Plus size={16} />
                      {editingEvent ? "Update Event" : "Add Event"}
                    </button>

                    {editingEvent && (
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => {
                          setEditingEvent(null);
                          setEventForm({
                            title: "",
                            description: "",
                            event_date: "",
                            location: ""
                          });
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </form>

                  {events.map(event => (
                    <div className="pending-row" key={event.id}>
                      <div>
                        <strong>{event.title}</strong>
                        <span>{event.event_date || "Date not set"}</span>
                      </div>

                      <div className="pending-actions">
                        <button
                          className="approve-btn"
                          onClick={() => {
                            setEditingEvent(event.id);
                            setEventForm({
                              title: event.title || "",
                              description: event.description || "",
                              event_date: event.event_date || "",
                              location: event.location || ""
                            });
                          }}
                        >
                          Edit
                        </button>

                        <button
                          className="reject-btn"
                          onClick={() => deleteEvent(event.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* COMMITTEE MANAGEMENT */}
                <div className="content-card" style={{ marginTop: 24 }}>
                  <h3>Manage Committee</h3>

                  <form onSubmit={saveCommittee}>
                    <label>Name</label>
                    <input
                      required
                      value={committeeForm.name}
                      onChange={e => setCommitteeForm({
                        ...committeeForm,
                        name: e.target.value
                      })}
                    />

                    <label>Position</label>
                    <input
                      required
                      value={committeeForm.position}
                      onChange={e => setCommitteeForm({
                        ...committeeForm,
                        position: e.target.value
                      })}
                    />

                    <label>Batch</label>
                    <input
                      value={committeeForm.batch}
                      onChange={e => setCommitteeForm({
                        ...committeeForm,
                        batch: e.target.value
                      })}
                    />

                    <label>Photo URL</label>
                    <input
                      value={committeeForm.photo_url}
                      onChange={e => setCommitteeForm({
                        ...committeeForm,
                        photo_url: e.target.value
                      })}
                    />

                    <label>Display Order</label>
                    <input
                      type="number"
                      value={committeeForm.display_order}
                      onChange={e => setCommitteeForm({
                        ...committeeForm,
                        display_order: Number(e.target.value)
                      })}
                    />

                    <button className="btn-primary">
                      <Plus size={16} />
                      {editingCommittee
                        ? "Update"
                        : "Add Committee Member"}
                    </button>

                    {editingCommittee && (
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => {
                          setEditingCommittee(null);
                          setCommitteeForm({
                            name: "",
                            position: "",
                            batch: "",
                            photo_url: "",
                            display_order: 0
                          });
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </form>

                  {committee.map(person => (
                    <div className="pending-row" key={person.id}>
                      <div>
                        <strong>{person.name}</strong>
                        <span>{person.position}</span>
                      </div>

                      <div className="pending-actions">
                        <button
                          className="approve-btn"
                          onClick={() => {
                            setEditingCommittee(person.id);
                            setCommitteeForm({
                              name: person.name || "",
                              position: person.position || "",
                              batch: person.batch || "",
                              photo_url: person.photo_url || "",
                              display_order: person.display_order || 0
                            });
                          }}
                        >
                          Edit
                        </button>

                        <button
                          className="reject-btn"
                          onClick={() => deleteCommittee(person.id)}
                        >
                          Delete
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

      {/* FOOTER */}
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

function FormField({
  label,
  value,
  onChange,
  type = "text",
  required = false
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={value ?? ""}
        required={required}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
