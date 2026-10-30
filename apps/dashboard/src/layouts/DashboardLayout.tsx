import { Outlet } from "react-router-dom";

import { Sidebar } from "../components/Sidebar/Sidebar";
import { Header } from "../components/Header/Header";
import { VisitorNotifications } from "../components/VisitorNotifications/VisitorNotifications";

import "./DashboardLayout.css";

export function DashboardLayout(){

return(

<div className="dashboard-layout">

<Sidebar/>
<VisitorNotifications/>

<main className="dashboard-layout__content">

<Header/>

<Outlet/>

</main>

</div>

);

}