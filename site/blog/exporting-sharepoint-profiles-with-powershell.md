---
title: 'Exporting SharePoint User Profiles to CSV using Powershell'
date: 2013-10-14
featured_image: /images/blog/exporting-sharepoint-profiles-with-powershell.jpg
tags:
  - blog
  - enterprise
---

You may have the (mis-)fortune of working with Sharepoint, and you may also need to gain access to the User Profile data contained therein. You may also want to try out Microsoft's PowerShell scripting language. If so, you came to the right place, my friend!

This seems like a common enough task, but the code I found in my Googling just wasnt doing it for me, so I am adding this version to the interwebs in the hopes someone else will find it useful.

```powershell
#
# Export Sharepoint User Profiles to CSV file
# John Lynch 2013
# MIT License

$siteUrl = "http://YOUR_HOSTNAME_HERE"
$outputFile = "c:\temp\sharepoint_user_profiles.csv"


Add-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue
$serviceContext = Get-SPServiceContext -Site $siteUrl
$profileManager = New-Object Microsoft.Office.Server.UserProfiles.UserProfileManager($serviceContext);
$profiles = $profileManager.GetEnumerator()

$fields = @(
            "SID",
            "ADGuid",
            "AccountName",
            "FirstName",
            "LastName",
            "PreferredName",
            "WorkPhone",
            "Office",
            "Department",
            "Title",
            "Manager",
            "AboutMe",
            "UserName",
            "SPS-Skills",
            "SPS-School",
            "SPS-Dotted-line",
            "SPS-Peers",
            "SPS-Responsibility",
            "SPS-PastProjects",
            "SPS-Interests",
            "SPS-SipAddress",
            "SPS-HireDate",
            "SPS-Location",
            "SPS-TimeZone",
            "SPS-StatusNotes",
            "Assistant",
            "WorkEmail",
            "SPS-ClaimID",
            "SPS-ClaimProviderID",
            "SPS-ClaimProviderType",
            "CellPhone",
            "Fax",
            "HomePhone",
            "PictureURL"
           )

$collection = @()

foreach ($profile in $profiles) {
   $user = "" | select $fields
   foreach ($field in $fields) {
     if($profile[$field].Property.IsMultivalued) {
       $user.$field = $profile[$field] -join "|"
     } else {
       $user.$field = $profile[$field].Value
     }
   }
   $collection += $user
}

$collection | Export-Csv $outputFile -NoTypeInformation
$collection |  Out-GridView
```
