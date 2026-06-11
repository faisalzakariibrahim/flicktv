import json
with open('scripts/working_channels.json') as f:
    data = json.load(f)

print(f'Total channels in working_channels.json: {len(data)}')

cats = {}
countries = {}
for c in data:
    cat = c.get('category', 'unknown')
    cats[cat] = cats.get(cat, 0) + 1
    country = c.get('country', 'unknown')
    if country:
        countries[country] = countries.get(country, 0) + 1

print('\nCategories:')
for k, v in sorted(cats.items(), key=lambda x: -x[1]):
    print(f'  {k}: {v}')

print(f'\nCountries ({len(countries)} unique):')
for k, v in sorted(countries.items(), key=lambda x: -x[1])[:15]:
    print(f'  {k}: {v}')

# Check fields
sample = data[0]
print(f'\nSample channel fields: {list(sample.keys())}')
print(f'Sample: {json.dumps(sample, indent=2)[:500]}')
