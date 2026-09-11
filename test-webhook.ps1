$u = 'https://msrdnacsawjjwpqxgcaf.functions.supabase.co/wa-inbound?token=test123456'
$json = @'
{
  "from": "21658291563",
  "type": "image",
  "mediaUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Fronalpstock_big.jpg/640px-Fronalpstock_big.jpg",
  "caption": "Test caption depuis simulation"
}
'@
try {
    $response = Invoke-RestMethod -Method Post -Uri $u -ContentType 'application/json' -Body $json
    Write-Output "SUCCESS: $($response | ConvertTo-Json)"
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        Write-Output "Response: $($reader.ReadToEnd())"
    }
}
